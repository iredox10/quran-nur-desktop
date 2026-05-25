import { Client, Databases, Permission, Role } from 'node-appwrite';
import fs from 'fs';

// Parse .env manually
const envVars = {};
const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        envVars[key] = value;
    }
});

const client = new Client()
    .setEndpoint(envVars['VITE_APPWRITE_ENDPOINT'])
    .setProject(envVars['VITE_APPWRITE_PROJECT_ID'])
    .setKey(envVars['API_KEY']);

const databases = new Databases(client);
const databaseId = envVars['VITE_APPWRITE_DATABASE_ID'];

const GROUPS_ID = 'sauka_groups';
const ASSIGNMENTS_ID = 'sauka_assignments';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createCollections() {
    console.log(`Setting up Sauka collections in DB: ${databaseId}...`);

    try {
        // Delete if exists to start fresh
        try {
            await databases.deleteCollection(databaseId, GROUPS_ID);
            console.log(`Deleted existing ${GROUPS_ID}`);
            await sleep(1000);
        } catch (e) { console.log(`Failed to delete ${GROUPS_ID}:`, e.message); }
        
        try {
            await databases.deleteCollection(databaseId, ASSIGNMENTS_ID);
            console.log(`Deleted existing ${ASSIGNMENTS_ID}`);
            await sleep(1000);
        } catch (e) { console.log(`Failed to delete ${ASSIGNMENTS_ID}:`, e.message); }

        // 1. Create sauka_groups Collection
        console.log(`Creating collection: ${GROUPS_ID}...`);
        await databases.createCollection(databaseId, GROUPS_ID, 'Sauka Groups', [
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users())
        ]);
        console.log('Collection created.');

        // Add Attributes
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'title', 200, true);
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'createdBy', 50, true);
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'createdByName', 100, true);
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'divisionType', 20, true);
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'joinCode', 6, true);
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'deadline', 30, false);
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'status', 20, true);
        await databases.createStringAttribute(databaseId, GROUPS_ID, 'completedAt', 30, false);
        console.log('Added attributes to sauka_groups. Waiting for attributes to process...');
        await sleep(2000);

        // Add Index
        try {
            await databases.createIndex(databaseId, GROUPS_ID, 'idx_joinCode', 'unique', ['joinCode']);
        } catch (e) {
            if (e.code !== 409) console.log('Index creation error:', e.message);
        }

        // 2. Create sauka_assignments Collection
        console.log(`\nCreating collection: ${ASSIGNMENTS_ID}...`);
        await databases.createCollection(databaseId, ASSIGNMENTS_ID, 'Sauka Assignments', [
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users())
        ]);
        console.log('Collection created.');

        // Add Attributes
        await databases.createStringAttribute(databaseId, ASSIGNMENTS_ID, 'groupId', 50, true);
        await databases.createIntegerAttribute(databaseId, ASSIGNMENTS_ID, 'partNumber', true, 1, 114);
        await databases.createStringAttribute(databaseId, ASSIGNMENTS_ID, 'claimedBy', 50, false);
        await databases.createStringAttribute(databaseId, ASSIGNMENTS_ID, 'claimedByName', 100, false);
        await databases.createStringAttribute(databaseId, ASSIGNMENTS_ID, 'status', 20, true);
        await databases.createStringAttribute(databaseId, ASSIGNMENTS_ID, 'claimedAt', 30, false);
        await databases.createStringAttribute(databaseId, ASSIGNMENTS_ID, 'completedAt', 30, false);
        console.log('Added attributes to sauka_assignments. Waiting for attributes to process...');
        await sleep(2000);

        // Add Index
        try {
            await databases.createIndex(databaseId, ASSIGNMENTS_ID, 'idx_groupId', 'key', ['groupId']);
        } catch (e) {
            if (e.code !== 409) console.log('Index creation error:', e.message);
        }

        console.log('\n✅ Successfully set up Appwrite collections and attributes for Sauka!');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

createCollections();
