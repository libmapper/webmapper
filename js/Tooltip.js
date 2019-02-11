'use strict';

class Tooltip {
    constructor() {
        $('body').append("<div id='tooltip'></div>");
        this._div = $('#tooltip');
    }

    showTable(header, data, x, y) {
        this._div.stop(true, false)
                 .empty()
                 .append(Tooltip._makeInfoTable(header, data))
                 .css({'left': x + 20,
                       'top': y,
                       'opacity': 1});
    }

    hide(immediate) {
        var dur = 200;
        if (immediate) dur = 0;
        this._div.animate({opacity: 0}, {duration: dur});
    }

    showBrief(line, x, y) {
        this._div.stop(true, false)
                 .empty()
                 .text(line)
                 .css({'left': x + 10,
                       'top': y + 60,
                       'opacity': 1})
                 .animate({opacity: 0}, {duration: 2000});
    }

    static _makeInfoTable(h, d) {
        var header = "<tr><th colspan='2'>" + h + "</th></tr>";
        var data = '';
        for (key in d) {
            if (!d.hasOwnProperty(key)) continue;
            data += "<tr><td>"key+"</td><td>"+d[key]+"</td></tr>";
        }
        return "<table class=infoTable><tbody>"+header+data+"</tbody>";
    }
}
