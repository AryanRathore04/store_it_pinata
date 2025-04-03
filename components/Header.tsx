import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Search from "@/components/Search";
import FileUploader from "@/components/FileUploader";
import { signOutUser } from "@/lib/actions/user.actions";
import { ModeToggle } from "./ModeToggle";

const Header = ({
  userId,
  accountId,
}: {
  userId: string;
  accountId: string;
}) => {
  return (
    <header className="header flex items-center justify-between p-4 bg-white dark:bg-gray-900">
      <Search />
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        Store It
      </h1>
      <div className="header-wrapper">
        <FileUploader ownerId={userId} accountId={accountId} />
        <ModeToggle />
        <form
          action={async () => {
            "use server";

            await signOutUser();
          }}
        >
          <Button type="submit" className="sign-out-button">
            <Image
              src="/assets/icons/logout.svg"
              alt="logo"
              width={24}
              height={24}
              className="w-6"
            />
          </Button>
        </form>
      </div>
    </header>
  );
};
export default Header;
