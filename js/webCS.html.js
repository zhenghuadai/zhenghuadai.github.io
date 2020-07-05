(function() {
// file menu
(function() {
$('#loadimg').click(function() {
    $('#loadlocal').click();
});
$('#loadlocal').on('change', function(ev) {
    let input = ev.target;
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function(e) {
            $('#image000').attr('src', e.target.result);
        };

        reader.readAsDataURL(input.files[0]);
    }
});
$('#filemenu').menu();
})();


// view menu
$('#viewmenu').menu({
    select: function(e, ui) {
        let cmd = ui.item.attr('cmd');
        if (cmd == 0) {
        } else if (cmd == 1) {
        }
        if (cmd != undefined) {
        }
    }
});


// right buttons
$(function() {
    $('#AddonToggleButton').button();
    $('#GPUToggleButton').button();
    $('#timediv').button();
    $('#TestGPU').button();
});

// message box
function showMessage(txt) {
    $('#messagebox').html(txt);
    $('#messagebox').show();
    if (txt && txt.length > 0) {
        $('#messagebox').removeClass('minimize');
        $('#messagebox').addClass('ui-tooltip');
    } else {
        $('#messagebox').removeClass('ui-tooltip');
    }
    setTimeout(function() {
        $('#messagebox').addClass('minimize');
    }, 5000);
};
$('#messagebox')
    .hover(
        function() {
            $('#messagebox').removeClass('minimize');
        },
        function() {
            setTimeout(function() {
                $('#messagebox').addClass('minimize');
            }, 2000);
        });

$('#meesagebox').button();

App.showMessage = showMessage;
})();
