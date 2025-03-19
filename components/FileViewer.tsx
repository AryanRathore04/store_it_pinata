"use client";

import React, { useEffect, useState } from "react";

interface FileMetadata {
  url: string;
  encryptionKey: string; // Base64 encoded key
  iv: string;            // Base64 encoded IV
  authTag: string;       // Base64 encoded auth tag
  type: string;          // MIME type, e.g. "image/jpeg"
  name: string;
}

interface FileViewerProps {
  file: FileMetadata;
}

async function decryptFile(
  encryptedBuffer: ArrayBuffer,
  keyB64: string,
  ivB64: string,
  tagB64: string
): Promise<Blob> {
  // Convert Base64 strings back to Uint8Array
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(tagB64), (c) => c.charCodeAt(0));

  // Combine ciphertext and auth tag for decryption
  const ciphertext = new Uint8Array(encryptedBuffer);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  // Import the key
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt the data
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    combined
  );

  // Create and return a Blob from the decrypted data
  return new Blob([decryptedBuffer], { type: "application/octet-stream" });
}

const FileViewer: React.FC<FileViewerProps> = ({ file }) => {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndDecrypt = async () => {
      try {
        // Fetch the encrypted file from IPFS
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error("Failed to fetch encrypted file");
        }
        const encryptedBuffer = await response.arrayBuffer();
        // Decrypt the file using the provided encryption details
        const decryptedBlob = await decryptFile(
          encryptedBuffer,
          file.encryptionKey,
          file.iv,
          file.authTag
        );
        // Create an object URL for the decrypted Blob
        const url = URL.createObjectURL(decryptedBlob);
        setDecryptedUrl(url);
      } catch (err: any) {
        console.error("Decryption error:", err);
        setError("Failed to decrypt file");
      } finally {
        setLoading(false);
      }
    };

    fetchAndDecrypt();

    return () => {
      if (decryptedUrl) URL.revokeObjectURL(decryptedUrl);
    };
  }, [file]);

  if (loading) return <p>Loading file...</p>;
  if (error || !decryptedUrl) return <p>{error || "Error loading file"}</p>;

  // Display the decrypted file based on its MIME type
  if (file.type.startsWith("image")) {
    return (
      <div>
        <h2>{file.name}</h2>
        <img src={decryptedUrl} alt={file.name} style={{ maxWidth: "100%" }} />
      </div>
    );
  } else {
    return (
      <div>
        <h2>{file.name}</h2>
        <p>
          Your file is decrypted.{" "}
          <a href={decryptedUrl} target="_blank" rel="noopener noreferrer">
            Click here to view/download.
          </a>
        </p>
      </div>
    );
  }
};

export default FileViewer;
