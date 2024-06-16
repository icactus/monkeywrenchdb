<?php
// Enable detailed error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Set the target directory
$target_dir = "../pdfs/"; // Make sure this directory exists and is writable
$target_file = $target_dir . basename($_FILES["file"]["name"]);
$uploadOk = 1;
$fileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));

// Check if file already exists
if (file_exists($target_file)) {
    echo "Sorry, file already exists.<br>";
    $uploadOk = 0;
}

// Check file size (limit to 5MB)
if ($_FILES["file"]["size"] > 5000000) {
    echo "Sorry, your file is too large.<br>";
    $uploadOk = 0;
}

// Allow certain file formats
$allowedFileTypes = ['pdf', 'js', 'jpg'];
if (!in_array($fileType, $allowedFileTypes)) {
    echo "Sorry, only PDF, JS, and JPG files are allowed.<br>";
    $uploadOk = 0;
}

// Check if $uploadOk is set to 0 by an error
if ($uploadOk == 0) {
    echo "Sorry, your file was not uploaded.<br>";
} else {
    // Attempt to move the uploaded file to the target directory
    if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
        echo "The file " . htmlspecialchars(basename($_FILES["file"]["name"])) . " has been uploaded.<br>";
    } else {
        echo "Sorry, there was an error uploading your file.<br>";
        echo "Error code: " . $_FILES["file"]["error"] . "<br>";
        echo "Temp file: " . $_FILES["file"]["tmp_name"] . "<br>";
        echo "Target file: " . $target_file . "<br>";
        echo "Is target directory writable? " . (is_writable($target_dir) ? 'Yes' : 'No') . "<br>";
        echo "Is target file writable? " . (is_writable($target_file) ? 'Yes' : 'No') . "<br>";
    }
}
?>
