const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test route
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

const db = client.db(process.env.DB_NAME);

// Collections
const ebookCollection       = db.collection('ebooks');
const userCollection        = db.collection('users');
const purchaseCollection    = db.collection('purchases');
const bookmarkCollection    = db.collection('bookmarks');
const transactionCollection = db.collection('transactions');

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

        if (req.query.genre)        query.genre        = req.query.genre;
        if (req.query.availability === 'available') query.isSold = false;
        if (req.query.availability === 'sold')      query.isSold = true;

        if (req.query.minPrice || req.query.maxPrice) {
            query.price = {};
            if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
            if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
        }

        // Sorting
        let sortOption = { createdAt: -1 };
        if (req.query.sort === 'price_asc')  sortOption = { price: 1 };
        if (req.query.sort === 'price_desc') sortOption = { price: -1 };

        // Pagination
        const page     = parseInt(req.query.page) || 1;
        const perPage  = parseInt(req.query.perPage) || 12;
        const skip     = (page - 1) * perPage;

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

// GET featured ebooks (latest 6)
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
app.post('/api/ebooks', async (req, res) => {
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
app.delete('/api/ebooks/:id', async (req, res) => {
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

// GET user purchases
app.get('/api/purchases', async (req, res) => {
    try {
        const query = {};
        if (req.query.userId)  query.userId  = req.query.userId;
        if (req.query.ebookId) query.ebookId = req.query.ebookId;

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

// GET user bookmarks
app.get('/api/bookmarks', async (req, res) => {
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
app.post('/api/bookmarks', async (req, res) => {
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

// DELETE remove bookmark
app.delete('/api/bookmarks/:id', async (req, res) => {
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

// GET all transactions (admin)
app.get('/api/transactions', async (req, res) => {
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

// ─── STATS API (Admin) ───────────────────────────────────────

// GET dashboard stats
app.get('/api/stats', async (req, res) => {
    try {
        const totalEbooks      = await ebookCollection.countDocuments();
        const totalSold        = await purchaseCollection.countDocuments();
        const totalTransactions = await transactionCollection.find().toArray();
        const totalRevenue     = totalTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Ebooks by genre
        const genrePipeline = [
            { $group: { _id: '$genre', count: { $sum: 1 } } },
            { $project: { genre: '$_id', count: 1, _id: 0 } },
            { $sort: { count: -1 } }
        ];
        const ebooksByGenre = await ebookCollection.aggregate(genrePipeline).toArray();

        // Monthly sales
        const salesPipeline = [
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    sales: { $sum: '$amount' }
                }
            },
            { $sort: { '_id': 1 } }
        ];
        const monthlySales = await transactionCollection.aggregate(salesPipeline).toArray();

        res.send({ totalEbooks, totalSold, totalRevenue, ebooksByGenre, monthlySales });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─── TOP WRITERS ─────────────────────────────────────────────

app.get('/api/writers/top', async (req, res) => {
    try {
        const pipeline = [
            { $group: { _id: '$writerId', writerName: { $first: '$writerName' }, totalSales: { $sum: 1 } } },
            { $sort: { totalSales: -1 } },
            { $limit: 3 }
        ];
        const writers = await purchaseCollection.aggregate(pipeline).toArray();
        res.send(writers);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// GET all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await userCollection.find().toArray();
        res.send(users);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// PATCH update user role
app.patch('/api/users/:id', async (req, res) => {
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
app.delete('/api/users/:id', async (req, res) => {
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