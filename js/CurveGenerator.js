class CurveGenerator {
    constructor(props, onGenerated) {
        // If curve editor is open, return
        if ($('#curveEditorWindow').length) {
            return;
        }

        let c = 0.01;

        let body = $('body');
        $(body).append("<div id='curveEditorWindow' style='position:absolute;left:calc(50% - 30vh);top:25%;background:#494949;width:60vh;height:50vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border-radius:12px;'></div>");

        // Editor
        $('#curveEditorWindow').append("<div id='curveEditor' style='display:flex;height:80%;width:100%;justify-content:center;align-items:center'></div>");
        $('#curveEditor').append("<svg id='curveSvg' viewBox='0 0 100 100' style='width:90%;height:100%'></svg>");
        var canvas = Raphael($('#curveSvg')[0], '100%', '100%');
        canvas.path("M10 10L10 90L90 90").attr({'stroke-width': 0.25, 'stroke': '#FFF'});
        canvas.text(7, 10, props.dst_max).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});
        canvas.text(7, 85, props.dst_min).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});
        canvas.text(15, 95, props.src_min).attr({'font-size': 5, 'fill': '#FFF'});
        canvas.text(90, 95, props.src_max).attr({'font-size': 5, 'fill': '#FFF'});
        $('#curveSvg svg').css('overflow', 'visible');
        const reso = 20;
        let points = [];
        for (let i = 0; i <= reso; i++) {
            let x = i / reso;
            let y = get_curve_val(x, 0.0, 1.0, 0.0, 1.0, c);
            x = 10.0 + x * 80.0;
            y = 90 - y * 80.0;
            let circ = canvas.circle(x, y, 1).attr({'fill': '#FFF', 'stroke': '#FFF'});
            points.push(circ);
        }

        // Slider
        $('#curveEditor').append(`<input id='curveSlider' type='range' min='-16.0' max='16.0' step='0.1' value='${c}' style='height:90%;width:10%;-webkit-appearance: slider-vertical;'>`);
        $('#curveSlider').on('input', function(e) {
            c = $(e.target).val();
            if (c != 0) {
                for (let i = 0; i <= reso; i++) {
                    let x = i / reso;
                    let y = get_curve_val(x, 0.0, 1.0, 0.0, 1.0, c);
                    x = 10.0 + x * 80.0;
                    y = 90 - y * 80.0;
                    points[i].attr('cy', y);
                }
                let expr = generate_curve_display(props.src_min,
                                                  props.src_max,
                                                  props.dst_min,
                                                  props.dst_max,
                                                  c);
                $('#curveExprDisplay').empty().append('<p>'+expr+'</p>');
                $('#curveGenerate').removeClass('disabled');
            }

        });

        // Generate button
        $('#curveEditorWindow').append("<div id='curveExprDisplay' style='width:90%;text-align:center;color:white;'font-size': 5'>Drag slider to generate a curve</div>"
                                       +"<div id='curveGenerate' class='button sel disabled' style='width:80%;text-align:center;color:white'>Apply to map</div>");
        $('#curveGenerate').click(function(e) {
            e.stopPropagation();
            e.preventDefault();
            let expr = generate_curve(props.src_min,
                                      props.src_max,
                                      props.dst_min,
                                      props.dst_max,
                                      c);
            onGenerated(expr);
            $('#curveEditorWindow').remove();
        });
        $('#curveEditorWindow').on('click', function(e) {
            e.stopPropagation();
        });
        $(body).one('click', function(e) {
            e.stopPropagation();
            $('#curveEditorWindow').remove();
        });
    }
}
