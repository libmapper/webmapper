'use strict';

class Tooltip {
    constructor() {
        $('body').append("<div id='tooltip'></div>");
        this._div = $('#tooltip');
    }

    show(html, x, y) {
        this._div.stop(true, false)
                 .empty()
                 .append(html)
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

}
