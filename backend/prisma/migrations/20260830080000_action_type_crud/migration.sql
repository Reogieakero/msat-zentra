-- Extend ActionType enum for registrar academics CRUD audit entries
ALTER TYPE "ActionType" ADD VALUE 'create';
ALTER TYPE "ActionType" ADD VALUE 'update';
ALTER TYPE "ActionType" ADD VALUE 'delete';
