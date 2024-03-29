
//ROUGH IDEA - NOT TESTED! 
function evalPreload$$module$synpdf(req, res) {
    // Get the URL parameters
    var pieceName = req.query.piece;
    var instrument = req.query.part;
    var recordingName = req.query.recording;

    // Create a MySQL connection
    var connection = mysql.createConnection({
        host: 'localhost',
        user: 'user',
        password: 'password',
        database: 'database'
    });

    // Connect to the MySQL database
    connection.connect();

    // Query the MySQL database for the piece
    connection.query('SELECT * FROM pieces WHERE piece_name = ?', [pieceName], function (error, pieceResults, fields) {
        if (error) throw error;

        // Handle the results of the query
        var piece = pieceResults[0];

        // Query the MySQL database for the instrument
        connection.query('SELECT * FROM instruments WHERE instrument_name = ? AND piece_id = ?', [instrument, piece.piece_id], function (error, instrumentResults, fields) {
            if (error) throw error;

            // Handle the results of the query
            var instrument = instrumentResults[0];

            // Query the MySQL database for the recordings matching the piece and instrument
            connection.query('SELECT * FROM recordings WHERE piece_id = ? AND instrument_id = ?', [piece.piece_id, instrument.instrument_id], function (error, recordingResults, fields) {
                if (error) throw error;

                // Handle the results of the query
                var recording = recordingResults.find(recording => recording.recording_name === recordingName);

                if (recording) {
                    // Query the MySQL database for the metric matching the instrument and recording
                    connection.query('SELECT * FROM metrics WHERE instrument_id = ? AND recording_id = ?', [instrument.instrument_id, recording.recording_id], function (error, metricResults, fields) {
                        if (error) throw error;

                        // Handle the results of the query
                        var metric = metricResults[0];

                        // Set the metric_arr and times_arr variables
                        metric_arr$$module$synpdf = metric.metric_arr;
                        times_arr$$module$synpdf = recording.times_arr;

                        // Close the MySQL connection
                        connection.end();
                    });
                } else {
                    // If the recording doesn't exist, you can handle it accordingly
                    connection.end();
                }
            });
        });
    });
}