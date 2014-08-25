function maybe_load_more_content(event) {
    var scroller = this;        // element with scroll bars
    var $container;             // element that receives new content
    var src;                    // url for retrieving content
    var scrollHeight;
    var spinner, colspan;
    var serial = Date.now();
    var params;
    scrollHeight = scroller.scrollHeight || $('body')[0].scrollHeight;
    if ($(scroller).scrollTop() + $(scroller).height()
        >
        scrollHeight - 50)
    {
        $container = $(event.data.container);
        if (!$container.attr('data-infinite-content-href0')) {
            // Remember the first page source url, so we can refresh
            // from page 1 later.
            $container.attr('data-infinite-content-href0',
                            $container.attr('data-infinite-content-href'));
        }
        src = $container.attr('data-infinite-content-href');
        if (!src || !$container.is(':visible'))
            // Finished
            return;

        // Don't start another request until this one finishes
        $container.attr('data-infinite-content-href', null);
        spinner = '<div class="spinner spinner-32px spinner-h-center"></div>';
        if ($container.is('table,tbody,thead,tfoot')) {
            // Hack to determine how many columns a new tr should have
            // in order to reach full width.
            colspan = $container.closest('table').
                find('tr').eq(0).find('td,th').length;
            if (colspan == 0)
                colspan = '*';
            spinner = ('<tr class="spinner"><td colspan="' + colspan + '">' +
                       spinner +
                       '</td></tr>');
        }
        $container.find(".spinner").detach();
        $container.append(spinner);
        $container.attr('data-infinite-serial', serial);

        // Combine infiniteContentParams from multiple
        // sources. filterable.js might put its params in
        // infiniteContentParamsFilterable, etc.
        params = {};
        $.each($container.data(), function(datakey, datavalue) {
            if (/^infiniteContentParams/.exec(datakey)) {
                if (datavalue instanceof Object) {
                    $.each(datavalue, function(hkey, hvalue) {
                        if (hvalue instanceof Array) {
                            params[hkey] = (params[hkey] || []).concat(hvalue);
                        } else if (hvalue instanceof Object) {
                            $.extend(params[hkey], hvalue);
                        } else {
                            params[hkey] = hvalue;
                        }
                    });
                }
            }
        });
        $.each(params, function(k,v) {
            if (v instanceof Object) {
                params[k] = JSON.stringify(v);
            }
        });

        $.ajax(src,
               {dataType: 'json',
                type: 'GET',
                data: params,
                context: {container: $container, src: src, serial: serial}}).
            fail(function(jqxhr, status, error) {
                var $faildiv;
                var $container = this.container;
                if ($container.attr('data-infinite-serial') != this.serial) {
                    // A newer request is already in progress.
                    return;
                }
                if (jqxhr.readyState == 0 || jqxhr.status == 0) {
                    message = "Cancelled."
                } else if (jqxhr.responseJSON && jqxhr.responseJSON.errors) {
                    message = jqxhr.responseJSON.errors.join("; ");
                } else {
                    message = "Request failed.";
                }
                // TODO: report the message to the user.
                console.log(message);
                $faildiv = $('<div />').
                    attr('data-infinite-content-href', this.src).
                    addClass('infinite-retry').
                    append('<span class="fa fa-warning" /> Oops, request failed. <button class="btn btn-xs btn-primary">Retry</button>');
                $container.find('div.spinner').replaceWith($faildiv);
            }).
            done(function(data, status, jqxhr) {
                if ($container.attr('data-infinite-serial') != this.serial) {
                    // A newer request is already in progress.
                    return;
                }
                $container.find(".spinner").detach();
                $container.append(data.content);
                $container.attr('data-infinite-content-href', data.next_page_href);
            });
     }
}

function ping_all_scrollers() {
    // Send a scroll event to all scroll listeners that might need
    // updating. Adding infinite-scroller class to the window element
    // doesn't work, so we add it explicitly here.
    $('.infinite-scroller').add(window).trigger('scroll');
}

$(document).
    on('click', 'div.infinite-retry button', function() {
        var $retry_div = $(this).closest('.infinite-retry');
        var $container = $(this).closest('.infinite-scroller-ready')
        $container.attr('data-infinite-content-href',
                        $retry_div.attr('data-infinite-content-href'));
        $retry_div.
            replaceWith('<div class="spinner spinner-32px spinner-h-center" />');
        ping_all_scrollers();
    }).
    on('refresh-content', '[data-infinite-scroller]', function() {
        // Clear all rows, reset source href to initial state, and
        // (if the container is visible) start loading content.
        var first_page_href = $(this).attr('data-infinite-content-href0');
        if (!first_page_href)
            first_page_href = $(this).attr('data-infinite-content-href');
        $(this).
            html('').
            attr('data-infinite-content-href', first_page_href);
        ping_all_scrollers();
    }).
    on('ready ajax:complete', function() {
        $('[data-infinite-scroller]').each(function() {
            if ($(this).hasClass('infinite-scroller-ready'))
                return;
            $(this).addClass('infinite-scroller-ready');

            // $scroller is the DOM element that hears "scroll"
            // events: sometimes it's a div, sometimes it's
            // window. Here, "this" is the DOM element containing the
            // result rows. We pass it to maybe_load_more_content in
            // event.data.
            var $scroller = $($(this).attr('data-infinite-scroller'));
            if (!$scroller.hasClass('smart-scroll') &&
                'scroll' != $scroller.css('overflow-y'))
                $scroller = $(window);
            $scroller.
                addClass('infinite-scroller').
                on('scroll resize', { container: this }, maybe_load_more_content).
                trigger('scroll');
        });
    });
