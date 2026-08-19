# Celia - Chess Tournament Manager (PHP/MySQL Version)

This is a lightweight, cPanel-friendly version of the [Celia Chess Tournament Manager](https://github.com/A7reus/Celia). It has been completely rebuilt from its original Next.js/React/Turso architecture into a standard LAMP stack (Linux, Apache, MySQL, PHP) application.

This repository is tailored for easy deployment on **budget shared hosting environments** where Node.js and serverless databases are not supported or feasible.

## Features

- **Standard LAMP Stack:** Pure PHP backend with a MySQL database. No Node.js required.
- **Vanilla Frontend:** Fast, responsive, dark-mode Single Page Application built with vanilla HTML/CSS/JS without heavy frontend frameworks.
- **Advanced Swiss Pairings:** Fully ported Swiss-system chess pairing algorithm that respects player history and color preferences.
- **Tie-Break Scoring:** Computes standings dynamically using advanced chess tie-breaks like Buchholz and Sonneborn-Berger.

## Installation & Deployment (cPanel)

1. Clone or download this repository.
2. Upload all the files directly to your `public_html` directory (or a subdirectory) via FTP or the cPanel File Manager.
3. In cPanel, navigate to **MySQL Databases**. Create a new database and a new database user. Assign all privileges for the user to the database.
4. Open **phpMyAdmin**, select your newly created database, and import the `schema.sql` file provided in this repository.
5. Open `includes/db.php` in the File Manager editor and update the database connection credentials:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'your_database_name');
   define('DB_USER', 'your_database_user');
   define('DB_PASS', 'your_database_password');
   ```

## Default Admin Account

The `schema.sql` file automatically inserts a default admin account.

- **Username:** `admin`
- **Password:** `admin`

*Note: Please change this password or add a new admin account once you have logged in for the first time.*

## Structure

- `/api` - Contains backend PHP API endpoints serving JSON.
- `/assets` - Contains the vanilla `style.css` and `app.js` frontend files.
- `/includes` - Core PHP logic, including database connections, authentication, Swiss pairing (`pairing.php`), and scoring algorithms (`scoring.php`).
- `index.php` - The single-page entry point of the frontend.
- `schema.sql` - The MySQL database schema and initialization script.

## Origin

This is a fork and full PHP-rewrite of the original Next.js project [Celia](https://github.com/A7reus/Celia).
