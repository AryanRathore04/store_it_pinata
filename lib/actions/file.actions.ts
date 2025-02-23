"use server";

import { createAdminClient, createSessionClient } from "../appwrite"; // Corrected import path
import { InputFile } from "node-appwrite/file";
import { appwriteConfig } from "../appwrite/config"; // Corrected import path
import { ID, Models, Query } from "node-appwrite";
import { constructFileUrl, getFileType, parseStringify } from "../utils"; // Corrected import path
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../actions/user.actions"; // Corrected import path

// Function to upload file to IPFS using Pinata
export const uploadFileToIPFS = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: process.env.PINATA_API_KEY!,
      pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY!,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to IPFS");
  }

  const data = await response.json();
  return data.IpfsHash; // Return the IPFS CID
};

// Existing uploadFile function
const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

export const uploadFile = async ({
  file,
  ownerId,
  accountId,
  path,
}: UploadFileProps) => {
  const { storage, databases } = await createAdminClient();

  try {
    const ipfsCID = await uploadFileToIPFS(file); // Call the new IPFS upload function

    const bucketFile = await storage.createFile(
      appwriteConfig.bucketId,
      ID.unique(),
      InputFile.fromBuffer(file, file.name),
    );

    const fileDocument = {
      type: getFileType(bucketFile.name).type,
      name: bucketFile.name,
      url: constructFileUrl(bucketFile.$id),
      extension: getFileType(bucketFile.name).extension,
      size: bucketFile.sizeOriginal,
      owner: ownerId,
      accountId,
      users: [],
      bucketFileId: bucketFile.$id,
      ipfsCID, // Include the IPFS CID in the document
    };

    const newFile = await databases
      .createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.filesCollectionId,
        ID.unique(),
        fileDocument,
      )
      .catch(async (error: unknown) => {
        await storage.deleteFile(appwriteConfig.bucketId, bucketFile.$id);
        handleError(error, "Failed to create file document");
      });

    revalidatePath(path);
    return parseStringify(newFile);
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};

export const getFiles = async (ownerId: string, types: string[], searchText: string, sort: string) => {
  const { databases } = await createAdminClient();
  const response = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.filesCollectionId,
    [Query.equal("ownerId", ownerId)]
  );
  return {
    total: response.total,
    documents: response.documents,
  };
};

export const getTotalSpaceUsed = async (ownerId: string) => {
  const files = await getFiles(ownerId, [], "", ""); // Call with appropriate arguments
  return files.documents.reduce((total, file) => total + file.size, 0);
};

export const deleteFile = async (fileId: string) => {
  const { storage } = await createAdminClient();
  await storage.deleteFile(appwriteConfig.bucketId, fileId);
};

export const renameFile = async (fileId: string, newName: string) => {
  const { databases } = await createAdminClient();
  const fileDocument = await databases.getDocument(
    appwriteConfig.databaseId,
    appwriteConfig.filesCollectionId,
    fileId
  );
  fileDocument.name = newName;
  await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.filesCollectionId,
    fileId,
    fileDocument
  );
};

export const updateFileUsers = async (fileId: string, users: string[]) => {
  const { databases } = await createAdminClient();
  const fileDocument = await databases.getDocument(
    appwriteConfig.databaseId,
    appwriteConfig.filesCollectionId,
    fileId
  );
  fileDocument.users = users;
  await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.filesCollectionId,
    fileId,
    fileDocument
  );
}
