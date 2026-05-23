import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'quotex_clone';

let cached = global.__mongo;
if (!cached) {
  cached = global.__mongo = { client: null, db: null, promise: null };
}

export async function getDb() {
  if (cached.db) return cached.db;
  if (!cached.promise) {
    cached.promise = MongoClient.connect(uri).then((client) => {
      cached.client = client;
      cached.db = client.db(dbName);
      return cached.db;
    });
  }
  return cached.promise;
}
