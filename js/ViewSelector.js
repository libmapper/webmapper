class ViewSelector {
    constructor(container, view) {
        $(container).append(
            "<div id='viewSelectorDiv' class='topMenu' style='width:150px;'>"+
                "<div class='topMenuTitle'><strong>VIEW</strong></div>"+
                "<div class='topMenuContainer' style='padding:0px'>"+
                    "<div>"+
                        "<div id='chordButton' class='viewButton'></div>"+
                        "<div id='listButton' class='viewButton'></div>"+
                        "<div id='gridButton' class='viewButton'></div>"+
                        "<div id='canvasButton' class='viewButton'></div>"+
                    "</div>"+
                    "<div>"+
                        "<div id='graphButton' class='viewButton'></div>"+
                        "<div id='hiveButton' class='viewButton'></div>"+
                        "<div id='parallelButton' class='viewButton'></div>"+
                        "<div id='consoleButton' class='viewButton'></div>"+
                    "</div>"+
                "</div>"+
            "</div>");

        $('.viewButton').on("mousedown", function(e) {
            switch ($(this)[0].id) {
                case "listButton":
                    view.switch_view("list");
                    break;
                case "canvasButton":
                    view.switch_view("canvas");
                    break;
                case "graphButton":
                    view.switch_view("graph");
                    break;
                case "gridButton":
                    view.switch_view("grid");
                    break;
                case "hiveButton":
                    view.switch_view("hive");
                    break;
                case "parallelButton":
                    view.switch_view("parallel");
                    break;
                case "balloonButton":
                    view.switch_view("balloon");
                    break;
                case "linkButton":
                    view.switch_view("link");
                    break;
                case "chordButton":
                    view.switch_view("chord");
                    break;
                case "consoleButton":
                    view.switch_view("console");
                    break;
            }
        });
    }
}
