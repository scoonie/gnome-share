-- DropIndex
DROP INDEX "User_ldapDN_key";

-- AlterTable: remove ldapDN from User
ALTER TABLE "User" DROP COLUMN "ldapDN";

-- AlterTable: remove storageProvider from Share
ALTER TABLE "Share" DROP COLUMN "storageProvider";
