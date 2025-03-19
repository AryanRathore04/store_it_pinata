"use server";

import axios from "axios";
import { createAdminClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { ID, Models, Query } from "node-appwrite";
import { parseStringify, getFileType } from "../utils";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../actions/user.actions";
import crypto from "crypto";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;
const PINATA_BASE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_UNPIN_URL = "https://api.pinata.cloud/pinning/unpin/";

const handleError = (error: unknown, message: string) => {
  console.error(message, error);
  throw error;
};

/**
 * Encrypt a Buffer using AES-256-GCM.
 * Returns an object with:
 * - encrypted: Buffer of encrypted data
 * - key: Buffer (32 bytes)
 * - iv: Buffer (12 bytes)
 * - authTag: Buffer (16 bytes)
 */
const encryptBuffer = (buffer: Buffer) => {
  const key = crypto.randomBytes(32); // AES-256 key
  const iv = crypto.randomBytes(12);  // 12-byte IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, key, iv, authTag };
};

// Upload file to IPFS and store metadata in Appwrite (with encryption)
export const uploadFile = async (file: File, accountId: string, path: string) => {
  const { databases } = await createAdminClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("User not found");

  try {
    // Read file into a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Encrypt the file buffer using AES-256-GCM
    const { encrypted, key, iv, authTag } = encryptBuffer(buffer);

    // Create a Blob from the encrypted data
    const encryptedBlob = new Blob([encrypted], { type: file.type });
    const formData = new FormData();
    // Append the encrypted file with a .enc extension
    formData.append("file", encryptedBlob, `${file.name}.enc`);

    const pinataMetadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        owner: currentUser.$id,
        accountId: accountId,
      },
    });

    const pinataOptions = JSON.stringify({
      cidVersion: 1,
      customPinPolicy: {
        regions: [
          {
            id: "FRA1", // Example region – adjust as needed.
            desiredReplicationCount: 1,
          },
        ],
      },
    });

    formData.append("pinataMetadata", pinataMetadata);
    formData.append("pinataOptions", pinataOptions);

    const response = await axios.post(PINATA_BASE_URL, formData, {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.status !== 200) {
      throw new Error("Failed to upload file to IPFS");
    }

    const ipfsHash = response.data.IpfsHash;
    const fileUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    // Extract file type and extension
    const { type: fileType, extension } = getFileType(file.name);

    // Convert encryption details to Base64 strings for storage
    const keyB64 = key.toString("base64");
    const ivB64 = iv.toString("base64");
    const tagB64 = authTag.toString("base64");

    // Store file metadata in Appwrite Database; bucketFileId stores the IPFS hash.
    const fileDocument = {
      type: fileType, // Required attribute
      extension,
      name: file.name,
      url: fileUrl,
      size: file.size,
      owner: currentUser.$id,
      accountId,
      users: [],
      bucketFileId: ipfsHash, // Using the IPFS hash as bucketFileId
      encryptionKey: keyB64,
      iv: ivB64,
      authTag: tagB64,
      encrypted: true,
    };

    const newFile = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      ID.unique(),
      fileDocument
    );

    revalidatePath(path);
    return parseStringify(newFile);
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};

// Fetch all files stored on IPFS
export const getFiles = async (types: string[], searchText: string, sort: string) => {
  const { databases } = await createAdminClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("User not found");

  try {
    const queries = [
      Query.or([
        Query.equal("owner", currentUser.$id),
        Query.contains("users", currentUser.email)
      ]),
      Query.orderDesc("$createdAt")
    ];

    // Optionally filter by file type
    if (types.length > 0) {
      queries.push(Query.equal("type", types));
    }

    // Optionally add search text filtering
    if (searchText) {
      queries.push(Query.search("name", searchText));
    }

    // Add sorting if provided; otherwise, default to created date ordering
    if (sort) {
      queries.push(Query.orderDesc(sort));
    }

    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      queries
    );

    return parseStringify(files);
  } catch (error) {
    handleError(error, "Failed to get files");
  }
};

// Get total space used by current user (in bytes)
export const getTotalSpaceUsed = async () => {
  const { databases } = await createAdminClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("User not found");

  try {
    const queries = [Query.equal("owner", currentUser.$id)];
    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      queries
    );

    // Initialize summary object with breakdown by type.
    const summary = {
      used: 0,
      document: { size: 0, latestDate: null },
      image: { size: 0, latestDate: null },
      video: { size: 0, latestDate: null },
      audio: { size: 0, latestDate: null },
      other: { size: 0, latestDate: null },
    };

    files.documents.forEach((doc: any) => {
      const size = doc.size || 0;
      summary.used += size;

      const fileType = doc.type as keyof typeof summary;
      if (typeof summary[fileType] === 'object') {
        summary[fileType].size += size;
        if (!summary[fileType].latestDate || new Date(doc.$createdAt) > new Date(summary[fileType].latestDate)) {
          summary[fileType].latestDate = doc.$createdAt;
        }
      } else {
        summary.other.size += size;
        if (!summary.other.latestDate || new Date(doc.$createdAt) > new Date(summary.other.latestDate)) {
          summary.other.latestDate = doc.$createdAt;
        }
      }
    });

    return summary;
  } catch (error) {
    handleError(error, "Failed to get total space used");
  }
};

// Delete file from IPFS and Appwrite Database
export const deleteFile = async (fileId: string, ipfsHash: string) => {
  const { databases } = await createAdminClient();

  try {
    console.log("Deleting file with IPFS Hash:", ipfsHash);
    console.log("JWT Token:", PINATA_JWT);

    if (!ipfsHash) {
      throw new Error("IPFS hash is undefined");
    }

    const response = await axios.delete(`${PINATA_UNPIN_URL}${ipfsHash}`, {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });

    if (response.status === 200) {
      console.log("File successfully removed from Pinata");

      // Remove the file record from Appwrite Database
      await databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.filesCollectionId,
        fileId
      );
    } else {
      console.error("Failed to unpin file from IPFS", response.data);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Pinata Unpin API Error:", error.response?.data || error.message);
    } else {
      console.error("Unexpected Error:", error);
    }
    throw error;
  }
};

// Rename file in Appwrite Database
export const renameFile = async (fileId: string, newName: string) => {
  const { databases } = await createAdminClient();

  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      { name: newName }
    );
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

// Update file users in Appwrite Database
export const updateFileUsers = async (fileId: string, users: string[]) => {
  const { databases } = await createAdminClient();
  try {
    // Update only the 'users' field without merging system attributes
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      { users }
    );
  } catch (error) {
    console.error("Failed to update file users", error);
    throw error;
  }
};
