"use server";

import axios from "axios";
import { createAdminClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { ID, Models, Query } from "node-appwrite";
import { parseStringify, getFileType } from "../utils";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../actions/user.actions";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;
const PINATA_BASE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_UNPIN_URL = "https://api.pinata.cloud/pinning/unpin/";

const handleError = (error: unknown, message: string) => {
  console.error(message, error);
  throw error;
};

// Upload file to IPFS and store metadata in Appwrite
export const uploadFile = async (file: File, accountId: string, path: string) => {
  const { databases } = await createAdminClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("User not found");

  try {
    // Upload file to IPFS (Pinata)
    const formData = new FormData();
    formData.append("file", file);

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
    const { type, extension } = getFileType(file.name);

    // Store file metadata in Appwrite Database; note bucketFileId stores the IPFS hash.
    const fileDocument = {
      type, // Required attribute
      extension,
      name: file.name,
      url: fileUrl,
      size: file.size,
      owner: currentUser.$id,
      accountId,
      users: [],
      bucketFileId: ipfsHash, // Using ipfsHash as the bucketFileId
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
      Query.equal("owner", currentUser.$id),
      Query.orderDesc("$createdAt"),
    ];

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
    // Sum the file sizes from each document
    const totalBytes = files.documents.reduce(
      (total: number, doc: any) => total + (doc.size || 0),
      0
    );
    return totalBytes;
  } catch (error) {
    handleError(error, "Failed to get total space used");
  }
};

// Delete file from IPFS and Appwrite Database
export const deleteFile = async (fileId: string, ipfsHash: string) => {
  const { databases } = await createAdminClient();

  try {
    // Remove file from Pinata IPFS
    await axios.delete(`${PINATA_UNPIN_URL}${ipfsHash}`, {
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
    });

    // Remove file record from Appwrite Database
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId
    );
  } catch (error) {
    handleError(error, "Failed to delete file");
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
    // Retrieve current file document
    const fileDocument = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId
    );
    // Update the users field
    const updatedDocument = { ...fileDocument, users };
    // Save changes to the document
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      updatedDocument
    );
  } catch (error) {
    console.error("Failed to update file users", error);
    throw error;
  }
};
