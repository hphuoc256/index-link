// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcrypt');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MongoClient } = require('mongodb');
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
const { DATABASE_URI, DATABASE_NAME } = process.env;
const uri = `${DATABASE_URI}`;

const client = new MongoClient(uri);

async function run() {
  try {
    const currentTime = new Date();
    const formattedDate = `${currentTime.getFullYear()}-${String(
      currentTime.getMonth() + 1,
    ).padStart(2, '0')}-${String(currentTime.getDate()).padStart(
      2,
      '0',
    )} ${String(currentTime.getHours()).padStart(2, '0')}:${String(
      currentTime.getMinutes(),
    ).padStart(2, '0')}:${String(currentTime.getSeconds()).padStart(
      2,
      '0',
    )}.${String(currentTime.getMilliseconds()).padStart(3, '0')}`;

    await client.connect();
    const myDB = client.db(`${DATABASE_NAME}`);
    const rolesCollection = myDB.collection('roles');
    const roles = [
      {
        name: 'admin',
        code: 'admin',
        description: 'Admin',
        created_at: formattedDate,
        updated_at: formattedDate,
      },
      {
        name: 'leader',
        code: 'leader',
        description: 'Leader',
        created_at: formattedDate,
        updated_at: formattedDate,
      },
      {
        name: 'user',
        code: 'user',
        description: 'User',
        created_at: formattedDate,
        updated_at: formattedDate,
      },
    ];
    await rolesCollection.insertMany(roles);

    const salt = await bcrypt.genSalt();
    const usersCollection = myDB.collection('users');
    const users = [
      {
        name: 'Super Admin',
        email: 'superadmin@gmail.com',
        password: await bcrypt.hash('password', salt),
        status: 'active',
        created_at: formattedDate,
        updated_at: formattedDate,
      },
    ];
    await usersCollection.insertMany(users);
    console.log('Insert data to MongoDB successfully!');
  } catch (e) {
    console.log(e);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
