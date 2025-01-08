//########################################
//# This page contains score data, timing data and the media file path. Save it as a javascipt file in
//# the same folder as synpdf.html. Synpdf preloads score and media when it is opened with the
//# file name as parameter in the url, for example: http://your.domain.org/synpdf.html?file_name.js
//# Also works locally with file:///path/to/synpdf.html?file_name.js
//# **** You may have to correct the path to the media file below! (media_file="...";) ****
//########################################
//#
pdf_file = "58-50.pdf";
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
"skipn":0,"seln":0,"eerst":0,"sysprf":0,"onestf":0,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,
"dx":3,"fixwd":1000},"3":{"drmpl":0.4,"drmpl2":2,"skipn":0,"seln":0,"eerst":0,"sysprf":0,
"onestf":0,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,"dx":3,"fixwd":1000}};
metric_arr = [1000,{"cxs":[{"cs":[333,338,343,348,354,421,429,437,445,453,521,529,537,544,552],
"xs":{"x1":169,"x2":951}},{"cs":[644,650,655,660,666,733,741,749,757,765,834,841,849,857,
865],"xs":{"x1":52,"x2":951}},{"cs":[960,965,972,977,982,1056,1063,1071,1079,1087,1158,1166,
1173,1181,1189],"xs":{"x1":51,"x2":947}}],"bxs":[[169,389,499,626,729,836,949],[52,256,371,
485,601,715,831,948],[51,253,367,481,592,717,833,945]]},{"cxs":[{"cs":[89,94,100,105,111,
172,179,188,195,203,268,276,284,292,299],"xs":{"x1":59,"x2":950}},{"cs":[387,392,397,402,
408,468,475,483,491,499,572,579,587,595,603],"xs":{"x1":48,"x2":950}},{"cs":[696,701,706,
712,717,780,788,797,805,812,877,885,893,900,908],"xs":{"x1":62,"x2":951}},{"cs":[996,1001,
1007,1012,1017,1075,1083,1092,1099,1107,1174,1181,1189,1197,1205],"xs":{"x1":50,"x2":953}}],
"bxs":[[59,237,337,437,537,638,743,841,948],[48,239,339,435,537,635,741,838,947],[62,241,
341,446,544,640,741,841,948],[50,242,342,445,542,646,748,844,950]]},{"cxs":[{"cs":[91,102,
107,113,170,178,186,194,261,269,277,285,293],"xs":{"x1":55,"x2":956}},{"cs":[387,392,398,
403,409,468,475,483,491,499,557,565,573,581,589],"xs":{"x1":55,"x2":956}},{"cs":[681,686,
692,697,702,771,779,787,795,803,862,870,877,885,893],"xs":{"x1":56,"x2":956}},{"cs":[992,
997,1003,1008,1013,1074,1081,1090,1098,1106,1166,1173,1181,1189,1197],"xs":{"x1":54,"x2":953}}],
"bxs":[[55,243,344,444,546,636,740,841,954],[55,238,345,452,548,646,748,845,954],[56,225,
305,422,525,631,738,843,954],[54,249,349,450,551,616,682,746,813,867,953]]}];

