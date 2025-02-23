declare module "../../lib/actions/file.actions" {
  export function uploadFile(fileData: {
    file: File;
    ownerId: string;
    accountId: string;
    path: string;
  }): Promise<any>;

  export function uploadFileToIPFS(file: File): Promise<string>;

  export function getFiles(ownerId: string): Promise<any[]>;
  export function getTotalSpaceUsed(ownerId: string): Promise<number>;
  export function deleteFile(fileId: string): Promise<void>;
  export function renameFile(fileId: string, newName: string): Promise<void>;
  export function updateFileUsers(fileId: string, users: string[]): Promise<void>;
}
