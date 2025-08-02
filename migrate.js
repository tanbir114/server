const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const Sentence = require("./models/sentence");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  throw new Error("MONGO_URI is not defined in the .env file");
}

async function migrate() {
  let connection;
  try {
    console.log("Connecting to MongoDB...");
    connection = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const Sentence = mongoose.model("Sentence");
    const totalDocuments = await Sentence.countDocuments();
    console.log(`Found ${totalDocuments} documents to process`);

    // Process in batches to avoid memory issues
    const batchSize = 100;
    let processed = 0;
    let migratedCount = 0;

    while (processed < totalDocuments) {
      const sentences = await Sentence.find({})
        .skip(processed)
        .limit(batchSize);

      if (sentences.length === 0) break;

      for (const sentence of sentences) {
        if (sentence.assignedTo && !Array.isArray(sentence.assignedTo)) {
          sentence.assignedTo = [sentence.assignedTo];
          await sentence.save();
          migratedCount++;
        }
      }

      processed += sentences.length;
      console.log(`Processed ${processed}/${totalDocuments} documents...`);
    }

    console.log(`\nMigration complete! Migrated ${migratedCount} documents`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  }
}

// Run the migration
migrate();
