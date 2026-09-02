-- Prisma doesn't auto-index a relation's own scalar FK column (only @unique/
-- @id get one) — these foreign keys had none at all, meaning every lookup
-- by boardId/groupId/itemId/userId on these tables was a full sequential
-- scan. Harmless at today's data volume (tens to low hundreds of rows per
-- board) but will matter as boards/items grow — purely additive, no data
-- or behavior change.

CREATE INDEX "Group_boardId_idx" ON "Group" ("boardId");
CREATE INDEX "GroupRoleAssignment_groupId_userId_idx" ON "GroupRoleAssignment" ("groupId", "userId");
CREATE INDEX "Column_boardId_idx" ON "Column" ("boardId");
CREATE INDEX "Item_boardId_idx" ON "Item" ("boardId");
CREATE INDEX "Item_groupId_idx" ON "Item" ("groupId");
CREATE INDEX "Item_parentId_idx" ON "Item" ("parentId");
CREATE INDEX "Attachment_itemId_idx" ON "Attachment" ("itemId");
CREATE INDEX "ActivityLogEntry_itemId_idx" ON "ActivityLogEntry" ("itemId");
CREATE INDEX "TodoItem_itemId_idx" ON "TodoItem" ("itemId");
CREATE INDEX "Assignment_userId_idx" ON "Assignment" ("userId");
CREATE INDEX "Comment_itemId_idx" ON "Comment" ("itemId");
CREATE INDEX "Notification_userId_idx" ON "Notification" ("userId");
CREATE INDEX "Notification_itemId_idx" ON "Notification" ("itemId");
CREATE INDEX "BoardMember_userId_idx" ON "BoardMember" ("userId");
