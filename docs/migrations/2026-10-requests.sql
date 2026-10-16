-- Run once before publishing requests.php. Safe to run again.
-- No foreign key to users: older installations use MyISAM for that table.
CREATE TABLE IF NOT EXISTS music_requests (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    composer_name VARCHAR(200) NOT NULL,
    piece_name VARCHAR(250) NOT NULL,
    part_name VARCHAR(200) NOT NULL,
    youtube_url VARCHAR(255) NULL,
    status ENUM('requested', 'in_progress', 'added', 'unable_to_add') NOT NULL DEFAULT 'requested',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY user_created (user_id, created_at),
    KEY queue_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS music_request_replies (
    id INT NOT NULL AUTO_INCREMENT,
    request_id INT NOT NULL,
    admin_user_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY request_thread (request_id, id),
    CONSTRAINT music_request_replies_request FOREIGN KEY (request_id) REFERENCES music_requests (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
