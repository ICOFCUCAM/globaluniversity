jQuery(document).ready(function ($) {
    // Attach click event to the dismiss button
    $(document).on('click', '.notice[data-notice="get-start"] button.notice-dismiss', function () {
        // Dismiss the notice via AJAX
        $.ajax({
            type: 'POST',
            url: ajaxurl,
            data: {
                action: 'flex_multi_business_dismissed_notice',
            },
            success: function () {
                // Remove the notice on success
                $('.notice[data-notice="example"]').remove();
            }
        });
    });
});

// Flex Importer plugin activation
document.addEventListener('DOMContentLoaded', function () {
    const flex_multi_business_button = document.getElementById('install-activate-button');

    if (!flex_multi_business_button) return;

    flex_multi_business_button.addEventListener('click', function (e) {
        e.preventDefault();

        const flex_multi_business_redirectUrl = flex_multi_business_button.getAttribute('data-redirect');

        // Step 1: Check if plugin is already active
        const flex_multi_business_checkData = new FormData();
        flex_multi_business_checkData.append('action', 'check_flex_import_activation');

        fetch(installFlexData.ajaxurl, {
            method: 'POST',
            body: flex_multi_business_checkData,
        })
        .then(res => res.json())
        .then(res => {
            if (res.success && res.data.active) {
                // Plugin is already active → just redirect
                window.location.href = flex_multi_business_redirectUrl;
            } else {
                // Not active → proceed with install + activate
                flex_multi_business_button.textContent = 'Installing & Activating...';

                const flex_multi_business_installData = new FormData();
                flex_multi_business_installData.append('action', 'install_and_activate_flex_import_plugin');
                flex_multi_business_installData.append('_ajax_nonce', installFlexData.nonce);

                fetch(installFlexData.ajaxurl, {
                    method: 'POST',
                    body: flex_multi_business_installData,
                })
                .then(res => res.json())
                .then(res => {
                    if (res.success) {
                        window.location.href = flex_multi_business_redirectUrl;
                    } else {
                        alert('Activation error: ' + (res.data?.message || 'Unknown error'));
                        flex_multi_business_button.textContent = 'Try Again';
                    }
                })
                .catch(error => {
                    alert('Request failed: ' + error.message);
                    flex_multi_business_button.textContent = 'Try Again';
                });
            }
        })
        .catch(error => {
            alert('Check request failed: ' + error.message);
        });
    });
});
