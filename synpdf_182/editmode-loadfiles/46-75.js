//########################################
//# This page contains score data, timing data and the media file path. Save it as a javascipt file in
//# the same folder as synpdf.html. Synpdf preloads score and media when it is opened with the
//# file name as parameter in the url, for example: http://your.domain.org/synpdf.html?file_name.js
//# Also works locally with file:///path/to/synpdf.html?file_name.js
//# **** You may have to correct the path to the media file below! (media_file="...";) ****
//########################################
//#
pdf_file = "46-48.pdf";
media_file = "";
msc_tracks = "";
offset_js = 0.00;
opt = {"speed":1,"no_menu":0,"btns":1,"spdctl":1,"cropx":0,"drmpl":0.4,"pagewd":1000,"synbox":0,
"wpdf":1,"lncsr":0,"nomed":0,"noplyr":0,"nodash":0,"skipn":0,"drmpl2":2,"seln":0,"delay":0,
"ipaddr":"","mstr":0,"bpmsr":"4-20-1","loop":false,"annot":0,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,
"dx":3,"fscr":0,"pagenum":1,"playbtn":0,"mmin":"","fixwd":1000,"lastSynced":-1,"eerst":0,
"sysprf":0,"onestf":0,"advncd":false};
lpRec = {"loopBtn":1,"loopStart":0,"loopEnd":7200};
times_arr = [];
adv_settings = {"1":{"drmpl":0.4,"drmpl2":2,"skipn":0,"seln":0,"eerst":0,"sysprf":0,"onestf":0,
"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,"dx":3,"fixwd":1000},"2":{"drmpl":0.4,"drmpl2":2,
"skipn":0,"seln":0,"eerst":0,"sysprf":true,"onestf":0,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,
"dx":3,"fixwd":1000},"3":{"drmpl":0.4,"drmpl2":2,"skipn":0,"seln":0,"eerst":0,"sysprf":true,
"onestf":0,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,"dx":3,"fixwd":1000},"4":{"drmpl":0.4,
"drmpl2":2,"skipn":0,"seln":0,"eerst":0,"sysprf":true,"onestf":0,"zwgrens":0.7,"voorna":0.9,
"mtdrmpl":0.8,"dx":3,"fixwd":1000}};
metric_arr = [1000,{"cxs":[{"cs":[370,378,386,393,400,448,455,462,469,477,529,536,543,551,558],
"xs":{"x1":163,"x2":915}},{"cs":[662,669,677,684,692,744,751,758,765,773,828,836,843,850,
858],"xs":{"x1":74,"x2":916}},{"cs":[959,966,974,981,989,1041,1048,1056,1063,1071,1138,1145,
1154,1161,1169],"xs":{"x1":76,"x2":917}}],"bxs":[[270,499,655,913],[74,403,668,914],[76,534,
915]]},{"cxs":[{"cs":[147,154,161,168,176,219,224,231,238,246,305,312,319,326,334],"xs":{"x1":86,
"x2":933}},{"cs":[412,420,427,435,442,495,502,509,517,524,580,587,594,602,609],"xs":{"x1":93,
"x2":932}},{"cs":[697,704,712,719,726,782,790,797,804,812,846,853,861,868,875],"xs":{"x1":87,
"x2":930}},{"cs":[967,1181],"xs":{"x1":93,"x2":926}}],"bxs":[[86,553,930],[93,405,679,929],
[87,427,654,904],[93,348,683,926]]},{"cxs":[{"cs":[143,151,158,165,173,214,221,228,235,243,
303,310,317,325,333],"xs":{"x1":76,"x2":914}},{"cs":[426,433,440,449,456,499,507,514,521,
529,583,591,598,605,612],"xs":{"x1":76,"x2":913}},{"cs":[698,705,712,719,726,774,781,789,
797,805,859,866,873,880,887],"xs":{"x1":75,"x2":911}},{"cs":[975,982,989,996,1004,1059,1067,
1074,1081,1090,1141,1150,1157,1165,1172],"xs":{"x1":75,"x2":910}}],"bxs":[[156,421,648,910],
[76,521,909],[75,537,908],[75,439,691,908]]},{"cxs":[{"cs":[148,155,162,169,176,218,225,233,
240,248,310,318,325,332,340],"xs":{"x1":91,"x2":937}},{"cs":[421,428,435,443,450,501,508,
515,522,529,586,593,601,608,615],"xs":{"x1":93,"x2":936}},{"cs":[699,706,713,721,728,779,
787,795,802,809,869,877,884,892,899],"xs":{"x1":102,"x2":936}},{"cs":[979,986,993,1000,1007,
1051,1058,1066,1073,1081,1142,1150,1158,1164,1172],"xs":{"x1":104,"x2":936}}],"bxs":[[91,
465,636,934],[93,438,619,934],[102,420,701,933],[104,516,687,928]]}];

