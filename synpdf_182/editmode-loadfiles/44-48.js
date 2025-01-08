//########################################
//# This page contains score data, timing data and the media file path. Save it as a javascipt file in
//# the same folder as synpdf.html. Synpdf preloads score and media when it is opened with the
//# file name as parameter in the url, for example: http://your.domain.org/synpdf.html?file_name.js
//# Also works locally with file:///path/to/synpdf.html?file_name.js
//# **** You may have to correct the path to the media file below! (media_file="...";) ****
//########################################
//#
pdf_file = "44-48.pdf";
media_file = "";
msc_tracks = "";
offset_js = 0.00;
opt = {"speed":1,"no_menu":0,"btns":1,"spdctl":1,"cropx":0,"drmpl":0.30000000000000004,"pagewd":1000,
"synbox":0,"wpdf":1,"lncsr":0,"nomed":0,"noplyr":0,"nodash":0,"skipn":0,"drmpl2":2,"seln":0,
"delay":0,"ipaddr":"","mstr":0,"bpmsr":"4-20-1","loop":false,"annot":0,"zwgrens":0.7,"voorna":0.9,
"mtdrmpl":0.8,"dx":3,"fscr":0,"pagenum":2,"playbtn":0,"mmin":"","fixwd":1000,"lastSynced":-1,
"eerst":0,"sysprf":true,"onestf":0,"advncd":false};
lpRec = {"loopBtn":1,"loopStart":0,"loopEnd":7200};
times_arr = [];
adv_settings = {"1":{"drmpl":0.30000000000000004,"drmpl2":2,"skipn":0,"seln":0,"eerst":0,"sysprf":true,
"onestf":0,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,"dx":3,"fixwd":1000},"2":{"drmpl":0.30000000000000004,
"drmpl2":2,"skipn":0,"seln":0,"eerst":0,"sysprf":true,"onestf":0,"zwgrens":0.7,"voorna":0.9,
"mtdrmpl":0.8,"dx":3,"fixwd":1000}};
metric_arr = [1000,{"cxs":[{"cs":[344,352,359,367,374,406,413,421,428,435,462,470,477,484,492],
"xs":{"x1":186,"x2":937}},{"cs":[539,546,554,561,568,632,640,647,655,662,670,690,698,705,
712,720],"xs":{"x1":66,"x2":937}},{"cs":[770,777,784,792,799,860,873,882,897,927,940,942,
949,957],"xs":{"x1":71,"x2":937}},{"cs":[1007,1014,1021,1029,1036,1110,1117,1125,1140,1168,
1176,1183,1191,1198],"xs":{"x1":65,"x2":936}}],"bxs":[[186,586,935],[135,543,935],[71,527,
935],[65,529,934]]},{"cxs":[{"cs":[127,135,142,150,157,230,236,241,248,256,263,271,320,327,
334,342,349],"xs":{"x1":64,"x2":936}},{"cs":[415,422,430,437,445,524,530,534,541,548,556,
563,611,618,626,633,641],"xs":{"x1":71,"x2":936}},{"cs":[712,719,727,734,741,828,835,843,
851,857,902,909,916,924,931],"xs":{"x1":71,"x2":936}},{"cs":[1007,1014,1022,1029,1037,1087,
1095,1102,1110,1117,1161,1169,1176,1184,1191],"xs":{"x1":70,"x2":935}}],"bxs":[[64,554,934],
[71,527,934],[71,535,934],[70,508,872,927]]}];

