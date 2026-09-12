-- No change is made when the production table already exists.
CREATE TABLE IF NOT EXISTS user_favorites (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    piece_id INT NOT NULL,
    metric_arr_id INT NULL,
    recording_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY user_piece (user_id, piece_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
