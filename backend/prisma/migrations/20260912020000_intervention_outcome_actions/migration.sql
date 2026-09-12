-- Audit actions for intervention assignment + outcome recording

ALTER TYPE "ActionType" ADD VALUE 'intervention_assigned';
ALTER TYPE "ActionType" ADD VALUE 'intervention_outcome';
