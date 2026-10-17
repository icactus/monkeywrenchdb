-- A favorite may be saved from the catalog before a score or recording is chosen.
-- Preserve all existing rows, IDs, indexes, and player context.
ALTER TABLE user_favorites
    MODIFY COLUMN metric_arr_id INT NULL DEFAULT NULL,
    MODIFY COLUMN recording_id INT NULL DEFAULT NULL;
