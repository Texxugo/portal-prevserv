-- CreateTable
CREATE TABLE "TodoBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TodoBoardMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TodoBoardMember_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TodoBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TodoColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TodoColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TodoBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TodoTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeUserId" TEXT,
    "assigneeName" TEXT,
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "order" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TodoTask_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TodoBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TodoTask_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "TodoColumn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TodoBoard_ownerId_idx" ON "TodoBoard"("ownerId");

-- CreateIndex
CREATE INDEX "TodoBoardMember_userId_idx" ON "TodoBoardMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoBoardMember_boardId_userId_key" ON "TodoBoardMember"("boardId", "userId");

-- CreateIndex
CREATE INDEX "TodoColumn_boardId_order_idx" ON "TodoColumn"("boardId", "order");

-- CreateIndex
CREATE INDEX "TodoTask_columnId_order_idx" ON "TodoTask"("columnId", "order");

-- CreateIndex
CREATE INDEX "TodoTask_boardId_idx" ON "TodoTask"("boardId");
