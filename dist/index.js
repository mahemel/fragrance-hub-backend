"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStableAPIConnect = runStableAPIConnect;
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const jose_cjs_1 = require("jose-cjs");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 5001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.send("FragranceHub Backend is running");
});
const uri = process.env.MONGODB_URI;
const DB = process.env.MONGODB_NAME;
if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable.");
}
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new mongodb_1.MongoClient(uri, {
    serverApi: {
        version: mongodb_1.ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
const JWKS = (0, jose_cjs_1.createRemoteJWKSet)(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
async function runStableAPIConnect() {
    try {
        const database = client.db(DB);
        const usersCollection = database.collection("user");
        const fragranceCollection = database.collection("fragrances");
        const fragrancesCollection = database.collection("fragrances");
        const verifyToken = async (req, res, next) => {
            const authHeader = req?.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: "Unauthorized access" });
            }
            const token = authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).send({ message: "Unauthorized access" });
            }
            try {
                const { payload } = await (0, jose_cjs_1.jwtVerify)(token, JWKS);
                next();
            }
            catch (error) {
                return res.status(403).json({ message: "Forbidden" });
            }
        };
        //Get User/users
        app.get("/api/users", verifyToken, async (req, res) => {
            const { id } = req.query;
            if (typeof id === "string") {
                const result = await usersCollection.findOne({
                    _id: new mongodb_1.ObjectId(id),
                });
                if (!result) {
                    return res.status(404).send({
                        message: "User not found",
                    });
                }
                return res.send(result);
            }
            const result = await usersCollection.find().toArray();
            const totalUsers = await usersCollection.countDocuments();
            res.send({ totalUsers, result });
        });
        //Add Fragrance
        app.post("/api/add/fragrance", verifyToken, async (req, res) => {
            const data = req.body;
            const fragrance = {
                ...data,
                createdAdd: new Date(),
            };
            const result = await fragranceCollection.insertOne(fragrance);
            res.send(result);
        });
        app.get("/api/fragrances", async (req, res) => {
            const { id } = req.query;
            if (typeof id === "string") {
                const result = await fragranceCollection.findOne({
                    _id: new mongodb_1.ObjectId(id),
                });
                if (!result) {
                    return res.status(404).send({
                        message: "Item not found",
                    });
                }
                return res.send(result);
            }
            const result = await fragranceCollection.find().toArray();
            res.send(result);
        });
        app.get("/api/users/fragrances/:userId", async (req, res) => {
            const { userId } = req.params;
            const query = { userId };
            const total = await fragranceCollection.countDocuments(query);
            const fragrances = await fragranceCollection
                .find(query)
                .sort({ createdAdd: -1 })
                .toArray();
            res.send({
                total,
                fragrances,
            });
        });
        app.get("/api/filter/fragrances", async (req, res) => {
            try {
                const query = {};
                const sort = {};
                const search = req.query.search;
                const gender = req.query.gender;
                const sortBy = req.query.sortBy;
                if (search) {
                    query.$or = [
                        {
                            name: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            gender: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            brand: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                    ];
                }
                if (gender) {
                    query.gender = {
                        $regex: `^${gender}$`,
                        $options: "i",
                    };
                }
                // SORTING
                switch (sortBy) {
                    case "latest":
                        sort.createdAdd = -1;
                        break;
                    case "oldest":
                        sort.createdAdd = 1;
                        break;
                    case "price-low-high":
                        sort.price = 1;
                        break;
                    case "price-high-low":
                        sort.price = -1;
                        break;
                    default:
                        sort.createdAdd = -1;
                }
                const page = Number(req.query.page) || 1;
                const perPage = Number(req.query.perPage) || 8;
                const total = await fragrancesCollection.countDocuments(query);
                const fragrances = await fragrancesCollection
                    .find(query)
                    .sort(sort)
                    .skip((page - 1) * perPage)
                    .limit(perPage)
                    .toArray();
                res.send({
                    total,
                    currentPage: page,
                    perPage,
                    totalPages: Math.ceil(total / perPage),
                    fragrances,
                });
            }
            catch (error) {
                console.error(error);
                res.status(500).send({ message: "Server error" });
            }
        });
        app.delete("/api/fragrances/:id", verifyToken, async (req, res) => {
            const { id } = req.params;
            const query = {
                _id: new mongodb_1.ObjectId(id),
            };
            const result = await fragrancesCollection.deleteOne(query);
            res.send(result);
        });
    }
    finally {
        // await client.close();
    }
}
runStableAPIConnect().catch(console.dir);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
