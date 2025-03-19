import { Models } from "node-appwrite";
import Link from "next/link";
import Thumbnail from "@/components/Thumbnail";
import { convertFileSize } from "@/lib/utils";
import FormattedDateTime from "@/components/FormattedDateTime";
import ActionDropdown from "@/components/ActionDropdown";

const Card = ({ file }: { file: Models.Document }) => {
  // Preserve the fileUrl for generating thumbnails (if needed)
  const fileUrl = file.url || "";
  
  // Determine the owner's display name
  const ownerName =
    file.owner && typeof file.owner === "object" && "fullName" in file.owner
      ? (file.owner as { fullName: string }).fullName
      : file.owner;

  return (
    <Link href={`/files/${file.$id}`} className="file-card">
      <div className="flex justify-between">
        <Thumbnail
          type={file.type}
          extension={file.extension}
          url={fileUrl}
          className="!size-20"
          imageClassName="!size-11"
        />
        <div className="flex flex-col items-end justify-between">
          {/* Wrap ActionDropdown in a div that stops click propagation */}
          <div onClick={(e) => e.stopPropagation()}>
            <ActionDropdown file={file} />
          </div>
          <p className="body-1">{convertFileSize(file.size)}</p>
        </div>
      </div>
      <div className="file-card-details">
        <p className="subtitle-2 line-clamp-1">{file.name}</p>
        <FormattedDateTime
          date={file.$createdAt}
          className="body-2 text-light-100"
        />
        <p className="caption line-clamp-1 text-light-200">
          By: {ownerName}
        </p>
      </div>
    </Link>
  );
};

export default Card;
