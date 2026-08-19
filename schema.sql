CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(255) PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_super TINYINT(1) NOT NULL DEFAULT 0,
  created_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'intradept',
  time_control VARCHAR(50) NOT NULL DEFAULT '10+5',
  rounds_count INT NOT NULL DEFAULT 7,
  default_rating INT NOT NULL DEFAULT 1200,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  admin_id INT NULL,
  created_at INT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(20) NOT NULL DEFAULT '',
  sex VARCHAR(10) NOT NULL DEFAULT '',
  batch VARCHAR(50) NOT NULL DEFAULT '',
  rating INT NOT NULL,
  rating_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE(tournament_id, name),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  number INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  UNIQUE(tournament_id, number),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pairings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  round_id INT NOT NULL,
  board INT NOT NULL,
  white_id INT NULL,
  black_id INT NULL,
  result VARCHAR(10) NULL,
  is_bye TINYINT(1) NOT NULL DEFAULT 0,
  bye_for_id INT NULL,
  UNIQUE(round_id, board),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (white_id) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY (black_id) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY (bye_for_id) REFERENCES players(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_limits (
  ip VARCHAR(45) PRIMARY KEY,
  failures INT NOT NULL DEFAULT 0,
  first_failure INT NOT NULL,
  locked_until INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes
CREATE INDEX idx_tournaments_admin ON tournaments(admin_id);
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_rounds_tournament ON rounds(tournament_id);
CREATE INDEX idx_pairings_round ON pairings(round_id);

-- Default admin user: password 'admin'
-- password_hash is generated with PHP password_hash('admin', PASSWORD_DEFAULT)
INSERT IGNORE INTO admins (username, password_hash, is_super, created_at) VALUES 
('admin', '$2y$12$kvym7ZWZOiuEwVUaZ29g6OdviW9aID9.cTHpHMu6yX62DzEcySVxi', 1, UNIX_TIMESTAMP());
