import React from "react";
import Sort from "../../../components/Sort";
import { getFiles, getTotalSpaceUsed } from "../../../lib/actions/file.actions";
import Card from "../../../components/Card";
import { getFileTypesParams } from "../../../lib/utils";
import { Models } from "node-appwrite"; // Ensure this import is included

const Page = async ({ searchParams, params }: SearchParamProps) => { 
  // No need to retrieve the current user here since our getFiles function handles that.
  const type = ((await params)?.type as string) || "";
  const searchText = ((await searchParams)?.query as string) || "";
  const sort = ((await searchParams)?.sort as string) || "";

  const types = getFileTypesParams(type) as FileType[];

  // Updated: Remove ownerId parameter since getFiles retrieves the current user internally.
  const files = await getFiles(types, searchText, sort);
  // Similarly, update getTotalSpaceUsed if it no longer expects an argument.
  const totalSpace = await getTotalSpaceUsed();

  return (
    <div className="page-container">
      <section className="w-full">
        <h1 className="h1 capitalize">{type}</h1>

        <div className="total-size-section">
          <p className="body-1">
            Total: <span className="h5">{totalSpace} MB</span>
          </p>

          <div className="sort-container">
            <p className="body-1 hidden text-light-200 sm:block">Sort by:</p>
            <Sort />
          </div>
        </div>
      </section>

      {/* Render the files */}
      {files.documents.length > 0 ? (
        <section className="file-list">
          {files.documents.map((file: Models.Document) => (
            <Card key={file.$id} file={file} />
          ))}
        </section>
      ) : (
        <p className="empty-list">No files uploaded</p>
      )}
    </div>
  );
};

export default Page;
