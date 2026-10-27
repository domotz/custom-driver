/**
 * Fixture: requests the next page on every reply, whatever the reply is.
 */
function fetchPage(page) {
    D.device.http.get({ url: "/items?page=" + page }, function () {
        fetchPage(page + 1);
    });
}

function validate() {
    fetchPage(1);
}
