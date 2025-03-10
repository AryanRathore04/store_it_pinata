"use client"

import React, { useEffect, useState } from "react";
import Sort from "../../../components/Sort";
import { getFiles, getTotalSpaceUsed } from "../../../lib/actions/file.actions";
import Card from "../../../components/Card";
import { convertFileSize, getFileTypesParams } from "../../../lib/utils";
import { Models } from "node-appwrite"; // Ensure this import is included

const Page = ({ searchParams, params }: SearchParamProps) => {
  const [files, setFiles] = useState<Models.Document[]>([]);
  const [totalSpace, setTotalSpace] = useState<{ used: number }>({ used: 0 });
  const [type, setType] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [sort, setSort] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const typeParam = ((await params)?.type as string) || "";
        const searchTextParam = ((await searchParams)?.query as string) || "";
        const sortParam = ((await searchParams)?.sort as string) || "";

        setType(typeParam);
        setSearchText(searchTextParam);
        setSort(sortParam);

        const types = getFileTypesParams(typeParam) as FileType[];
        const fetchedFiles = await getFiles(types, searchTextParam, sortParam);
        const fetchedTotalSpace = await getTotalSpaceUsed();

        setFiles(fetchedFiles.documents);
        setTotalSpace(fetchedTotalSpace);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [params, searchParams]);

  return (
    <div className="page-container">
      <section className="w-full">
        <h1 className="h1 capitalize">{type}</h1>

        <div className="total-size-section">
          <p className="body-1">
            Total:{" "}
            <span className="h5">{convertFileSize(totalSpace.used)} MB</span>
          </p>

          <div className="sort-container">
            <p className="body-1 hidden text-light-200 sm:block">Sort by:</p>
            <Sort />
          </div>
        </div>
      </section>

      {/* Render the files */}
      {files.length > 0 ? (
        <section className="file-list">
          {files.map((file: Models.Document) => (
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