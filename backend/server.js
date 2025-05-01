const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/shopdb";
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

// MongoDB Events
mongoose.connection.on("connected", () =>
  console.log("Mongoose connected to DB")
);
mongoose.connection.on("error", (err) =>
  console.error("Mongoose connection error:", err)
);
mongoose.connection.on("disconnected", () =>
  console.log("Mongoose disconnected")
);

// Schemas
const clientSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  age: { type: Number, required: true },
  email: { type: String, required: true, unique: true },
  commands: [{ type: mongoose.Schema.Types.ObjectId, ref: "Command" }],
});

const produitSchema = new mongoose.Schema({
  libelle: { type: String, required: true },
  pu: { type: Number, required: true },
  stock: { type: Number, default: 100 },
  category: { type: String, default: 'Non classé' }
});

const ligneCommandSchema = new mongoose.Schema({
  qte: { type: Number, required: true },
  produit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Produit",
    required: true,
  },
});

const commandSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now, required: true },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  lignes: [ligneCommandSchema],
  status: { type: String, default: 'En attente', enum: ['En attente', 'Expédié', 'Livré', 'Annulé'] }
});

// Models
const Client = mongoose.model("Client", clientSchema);
const Produit = mongoose.model("Produit", produitSchema);
const Command = mongoose.model("Command", commandSchema);

// Sample data initialization
const initializeData = async () => {
  try {
    const clientCount = await Client.countDocuments();
    if (clientCount > 0) {
      console.log("Data already exists");
      return;
    }

    // Create clients
    const client1 = await new Client({
      nom: "Mohamed",
      age: 28,
      email: "Mohamed@example.com",
      commands: [],
    }).save();

    const client2 = await new Client({
      nom: "Fatima",
      age: 34,
      email: "fatima@example.com",
      commands: [],
    }).save();
    
    const client3 = await new Client({
      nom: "Youssef",
      age: 42,
      email: "youssef@example.com",
      commands: [],
    }).save();

    // Create products
    const products = await Promise.all([
      new Produit({
        libelle: "Ordinateur Portable",
        pu: 1299.99,
        stock: 25,
        category: 'Informatique'
      }).save(),
      
      new Produit({ 
        libelle: "Smartphone", 
        pu: 799.99,
        stock: 50,
        category: 'Électronique'
      }).save(),
      
      new Produit({ 
        libelle: "Casque Audio", 
        pu: 149.99,
        stock: 100,
        category: 'Audio'
      }).save(),
      
      new Produit({ 
        libelle: "Clavier Mécanique", 
        pu: 89.99,
        stock: 35,
        category: 'Informatique'
      }).save(),
      
      new Produit({ 
        libelle: "Souris Sans Fil", 
        pu: 45.99,
        stock: 60,
        category: 'Informatique'
      }).save()
    ]);

    // Create commands
    const command1 = await new Command({
      client: client1._id,
      date: new Date('2025-04-15'),
      lignes: [
        { qte: 1, produit: products[0]._id },
        { qte: 2, produit: products[4]._id }
      ],
      status: 'Livré'
    }).save();

    const command2 = await new Command({
      client: client2._id,
      date: new Date('2025-04-20'),
      lignes: [
        { qte: 1, produit: products[1]._id },
        { qte: 1, produit: products[2]._id }
      ],
      status: 'Expédié'
    }).save();
    
    const command3 = await new Command({
      client: client3._id,
      date: new Date('2025-04-25'),
      lignes: [
        { qte: 3, produit: products[2]._id },
        { qte: 1, produit: products[3]._id },
        { qte: 1, produit: products[0]._id }
      ],
      status: 'En attente'
    }).save();
    
    const command4 = await new Command({
      client: client1._id,
      date: new Date('2025-04-28'),
      lignes: [
        { qte: 1, produit: products[3]._id }
      ],
      status: 'En attente'
    }).save();

    // Update client references
    await Client.findByIdAndUpdate(client1._id, {
      $push: { commands: { $each: [command1._id, command4._id] } }
    });

    await Client.findByIdAndUpdate(client2._id, {
      $push: { commands: command2._id }
    });
    
    await Client.findByIdAndUpdate(client3._id, {
      $push: { commands: command3._id }
    });

    console.log("Sample data initialized successfully");
  } catch (err) {
    console.error("Error initializing data:", err);
  }
};

// Routes

// Get all clients
app.get("/clients", async (req, res) => {
  try {
    const clients = await Client.find();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get commands by client
app.get("/commands/:clientId", async (req, res) => {
  try {
    const commands = await Command.find({
      client: req.params.clientId,
    }).populate("lignes.produit");
    res.json(commands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all products
app.get("/products", async (req, res) => {
  try {
    const products = await Produit.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update quantity in a command line
app.patch("/commands/:commandId/ligne/:ligneId", async (req, res) => {
  try {
    const { qte } = req.body;
    if (qte < 0)
      return res.status(400).json({ message: "Quantity cannot be negative" });

    const command = await Command.findById(req.params.commandId);
    if (!command) return res.status(404).json({ message: "Command not found" });

    const ligne = command.lignes.id(req.params.ligneId);
    if (!ligne) return res.status(404).json({ message: "Line item not found" });

    ligne.qte = qte;
    await command.save();

    res.json(command);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update command status
app.patch("/commands/:commandId/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!['En attente', 'Expédié', 'Livré', 'Annulé'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const command = await Command.findByIdAndUpdate(
      req.params.commandId,
      { status },
      { new: true }
    ).populate("lignes.produit");
    
    if (!command) return res.status(404).json({ message: "Command not found" });
    
    res.json(command);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start Server
const startServer = async () => {
  await connectDB();
  await initializeData();
  app.listen(3000, () =>
    console.log("Server running on http://localhost:3000")
  );
};

startServer();