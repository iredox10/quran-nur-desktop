import { Client, Account, Databases, Query } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
export const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'quran_db';
export const collectionId = import.meta.env.VITE_APPWRITE_USER_DATA_COLLECTION_ID || 'user_sync';

export const client = new Client();

if (endpoint && projectId) {
    client.setEndpoint(endpoint).setProject(projectId);
} else {
    console.error('Appwrite endpoint or project id is missing in .env');
}

export const account = new Account(client);
export const databases = new Databases(client);

// Auth Service Actions
export const authService = {
    async getCurrentUser() {
        try {
            return await account.get();
        } catch (error) {
            return null;
        }
    },
    async login(email, password) {
        return await account.createEmailPasswordSession(email, password);
    },
    async register(email, password, name) {
        return await account.create('unique()', email, password, name);
    },
    async sendPasswordRecovery(email, url) {
        return await account.createRecovery(email, url);
    },
    async logout() {
        return await account.deleteSession('current');
    }
};

export const syncService = {
    async pushState(userId, stateData) {
        try {
            const result = await databases.listDocuments(databaseId, collectionId, [
                Query.equal("userId", userId)
            ]);

            const payload = {
                userId,
                stateData: JSON.stringify(stateData)
            };

            let updatedDoc;
            if (result.documents.length > 0) {
                updatedDoc = await databases.updateDocument(databaseId, collectionId, result.documents[0].$id, payload);
            } else {
                updatedDoc = await databases.createDocument(databaseId, collectionId, 'unique()', payload);
            }
            return {
                updatedAt: new Date(updatedDoc.$updatedAt).getTime()
            };
        } catch (error) {
            console.error('Appwrite sync push error:', error);
            throw error;
        }
    },

    async pullState(userId) {
        try {
            const result = await databases.listDocuments(databaseId, collectionId, [
                Query.equal("userId", userId)
            ]);

            if (result.documents.length > 0) {
                return {
                    state: JSON.parse(result.documents[0].stateData),
                    updatedAt: new Date(result.documents[0].$updatedAt).getTime()
                };
            }
            return null;
        } catch (error) {
            console.error('Appwrite sync pull error:', error);
            throw error;
        }
    }
};
