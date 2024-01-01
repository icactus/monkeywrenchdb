// IDEAS FOR USING URLs TO DIRECTLY LOAD FILES

//This works with current loaded video.
ybplayer$$module$synpdf.seekTo('144').pauseVideo()

//To specify video url in this method use:
ybplayer$$module$synpdf.cueVideoById("UdCXUVhVSEE", "501")

//Except the above doesn't allow you to move to the cued measure location.
// Maybe that's too much of a feature. Or it could be done by doing time2x using the player cue
// startSeconds minus the js_offset.


//IN THE RECORDING CONTAINER CLICK LISTENER, DON'T DOWNLOAD ALL THE TIMES ARRAYS ALREADY
//SAME FOR PIECES CONTAINER CLICK LISTENER - WE DON'T NEED TO DOWNLOAD THE METRIC ARRAY ALREADY

