// app/files/[fileId]/page.tsx
import { getCurrentUser } from "@/lib/actions/user.actions";
import { createAdminClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import FileViewer from "@/components/FileViewer";
import { notFound } from "next/navigation";

async function getFileDocument(fileId: string) {
  const { databases } = await createAdminClient();
  try {
    const doc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId
    );
    return doc;
  } catch (error) {
    console.error("Error fetching file document:", error);
    return null;
  }
}

export default async function Page({ params }: { params: { fileId: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return notFound();
  }

  const fileDoc = await getFileDocument(params.fileId);
  if (!fileDoc) {
    return notFound();
  }

  // Assemble metadata for FileViewer
  const fileMetadata = {
    url: fileDoc.url,
    encryptionKey: fileDoc.encryptionKey || "",
    iv: fileDoc.iv || "",
    authTag: fileDoc.authTag || "",
    type: fileDoc.type || "application/octet-stream",
    name: fileDoc.name || "Untitled",
  };

  return (
    <main className="container mx-auto p-4">
      <FileViewer file={fileMetadata} />
    </main>
  );
}
