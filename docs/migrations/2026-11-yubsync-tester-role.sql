ALTER TABLE `users`
    MODIFY COLUMN `role` ENUM('user', 'admin', 'tester') NULL DEFAULT 'user';
