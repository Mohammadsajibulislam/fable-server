const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Fable Server is running!');
});

const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

client.connect(() => {
    console.log('Connected to MongoDB!');
}).catch(console.dir);

const db     = client.db(process.env.DB_NAME);
const authDb = client.db(process.env.AUTH_DB_NAME);

// Collections
const ebookCollection       = db.collection('ebooks');
const userCollection        = authDb.collection('user');
const purchaseCollection    = db.collection('purchases');
const bookmarkCollection    = db.collection('bookmarks');
const transactionCollection = db.collection('transactions');
const sessionCollection     = authDb.collection('session');

// ─── MIDDLEWARES ─────────────────────────────────────────────

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    const session = await sessionCollection.findOne({ token });
    if (!session) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    const user = await userCollection.findOne({ _id: session.userId });
    if (!user) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    req.user = user;
    next();
};

const verifyAdmin = async (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    next();
};

const verifyWriter = async (req, res, next) => {
    if (req.user?.role !== 'writer') {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    next();
};

// ─── EBOOKS API ──────────────────────────────────────────────

// GET all ebooks (search + filter + pagination)
app.get('/api/ebooks', async (req, res) => {
    try {
        const query = { status: 'published' };

        if (req.query.search) {
            query.$or = [
                { title:      { $regex: req.query.search, $options: 'i' } },
                { writerName: { $regex: req.query.search, $options: 'i' } },
            ];
        }

        if (req.query.genre) query.genre = req.query.genre;
        if (req.query.availability === 'available') query.isSold = false;
        if (req.query.availability === 'sold')      query.isSold = true;

        if (req.query.minPrice || req.query.maxPrice) {
            query.price = {};
            if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
            if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
        }

        let sortOption = { createdAt: -1 };
        if (req.query.sort === 'price_asc')  sortOption = { price: 1 };
        if (req.query.sort === 'price_desc') sortOption = { price: -1 };

        const page    = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 12;
        const skip    = (page - 1) * perPage;

        const total  = await ebookCollection.countDocuments(query);
        const ebooks = await ebookCollection
            .find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(perPage)
            .toArray();

        res.send({ ebooks, total });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// GET featured ebooks — :id এর আগে থাকতে হবে
app.get('/api/ebooks/featured', async (req, res) => {
    try {
        const ebooks = await ebookCollection
            .find({ status: 'published' })
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();
        res.send(ebooks);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// GET single ebook
app.get('/api/ebooks/:id', async (req, res) => {
    try {
        const ebook = await ebookCollection.findOne({
            _id: new ObjectId(req.params.id)
        });
        if (!ebook) return res.status(404).send({ message: 'Ebook not found' });
        res.send(ebook);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// GET writer's own ebooks
app.get('/api/my/ebooks', async (req, res) => {
    try {
        const { writerId } = req.query;
        const ebooks = await ebookCollection
            .find({ writerId })
            .sort({ createdAt: -1 })
            .toArray();
        res.send(ebooks);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// POST create ebook
app.post('/api/ebooks', verifyToken, verifyWriter, async (req, res) => {
    try {
        const ebook = {
            ...req.body,
            status: 'published',
            isSold: false,
            createdAt: new Date(),
        };
        const result = await ebookCollection.insertOne(ebook);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// PATCH update ebook
app.patch('/api/ebooks/:id', async (req, res) => {
    try {
        const result = await ebookCollection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body }
        );
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// DELETE ebook
app.delete('/api/ebooks/:id', verifyToken, async (req, res) => {
    try {
        const result = await ebookCollection.deleteOne({
            _id: new ObjectId(req.params.id)
        });
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─── PURCHASES API ───────────────────────────────────────────

// GET purchases
app.get('/api/purchases', verifyToken, async (req, res) => {
    try {
        const query = {};

        if (req.query.userId) {
            if (
                req.user._id.toString() !== req.query.userId &&
                req.user.role !== 'admin'
            ) {
                return res.status(403).send({ message: 'Forbidden access' });
            }
            query.userId = req.query.userId;
        }

        if (req.query.writerId) query.writerId = req.query.writerId;

        const purchases = await purchaseCollection
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();
        res.send(purchases);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// POST save purchase
app.post('/api/purchases', async (req, res) => {
    try {
        const purchase = { ...req.body, createdAt: new Date() };
        const result   = await purchaseCollection.insertOne(purchase);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─── BOOKMARKS API ───────────────────────────────────────────

// GET bookmarks
app.get('/api/bookmarks', verifyToken, async (req, res) => {
    try {
        const bookmarks = await bookmarkCollection
            .find({ userId: req.query.userId })
            .toArray();
        res.send(bookmarks);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// POST add bookmark
app.post('/api/bookmarks', verifyToken, async (req, res) => {
    try {
        const exists = await bookmarkCollection.findOne({
            userId:  req.body.userId,
            ebookId: req.body.ebookId,
        });
        if (exists) return res.send({ message: 'Already bookmarked' });

        const result = await bookmarkCollection.insertOne({
            ...req.body,
            createdAt: new Date(),
        });
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// DELETE bookmark
app.delete('/api/bookmarks/:id', verifyToken, async (req, res) => {
    try {
        const result = await bookmarkCollection.deleteOne({
            _id: new ObjectId(req.params.id)
        });
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─── TRANSACTIONS API ────────────────────────────────────────

// GET all transactions
app.get('/api/transactions', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const transactions = await transactionCollection
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.send(transactions);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// POST save transaction
app.post('/api/transactions', async (req, res) => {
    try {
        const result = await transactionCollection.insertOne({
            ...req.body,
            createdAt: new Date(),
        });
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─── STATS API ───────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
    try {
        const totalEbooks       = await ebookCollection.countDocuments();
        const totalSold         = await purchaseCollection.countDocuments();
        const totalTransactions = await transactionCollection.find().toArray();
        const totalRevenue      = totalTransactions.reduce(
            (sum, t) => sum + (t.amount || 0), 0
        );

        const genrePipeline = [
            { $group: { _id: '$genre', count: { $sum: 1 } } },
            { $project: { genre: '$_id', count: 1, _id: 0 } },
            { $sort: { count: -1 } }
        ];
        const ebooksByGenre = await ebookCollection
            .aggregate(genrePipeline).toArray();

        const salesPipeline = [
            {
                $group: {
                    _id:   { $month: '$createdAt' },
                    sales: { $sum: '$amount' }
                }
            },
            { $sort: { '_id': 1 } }
        ];
        const monthlySales = await transactionCollection
            .aggregate(salesPipeline).toArray();

        res.send({ totalEbooks, totalSold, totalRevenue, ebooksByGenre, monthlySales });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─── TOP WRITERS ─────────────────────────────────────────────

app.get('/api/writers/top', async (req, res) => {
    try {
        const pipeline = [
            {
                $group: {
                    _id:        '$writerId',
                    writerName: { $first: '$writerName' },
                    totalSales: { $sum: 1 }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 3 }
        ];
        const writers = await purchaseCollection.aggregate(pipeline).toArray();
        res.send(writers);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─── USERS API ───────────────────────────────────────────────

// GET all users
app.get('/api/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const users = await userCollection.find().toArray();
        res.send(users);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// PATCH update user role
app.patch('/api/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const result = await userCollection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body }
        );
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// DELETE user
app.delete('/api/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const result = await userCollection.deleteOne({
            _id: new ObjectId(req.params.id)
        });
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Export for Vercel
module.exports = app;

app.listen(port, () => {
    console.log(`Fable server running on port ${port}`);
});