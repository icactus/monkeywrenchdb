<?php
/**
 * Theme functions and definitions
 *
 * @package HelloElementor
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

define('HELLO_ELEMENTOR_VERSION', '3.2.1');

if (!isset($content_width)) {
    $content_width = 800; // Pixels.
}

if (!function_exists('hello_elementor_setup')) {
    /**
     * Set up theme support.
     *
     * @return void
     */
    function hello_elementor_setup()
    {
        if (is_admin()) {
            hello_maybe_update_theme_version_in_db();
        }

        if (apply_filters('hello_elementor_register_menus', true)) {
            register_nav_menus(['menu-1' => esc_html__('Header', 'hello-elementor')]);
            register_nav_menus(['menu-2' => esc_html__('Footer', 'hello-elementor')]);
        }

        if (apply_filters('hello_elementor_post_type_support', true)) {
            add_post_type_support('page', 'excerpt');
        }

        if (apply_filters('hello_elementor_add_theme_support', true)) {
            add_theme_support('post-thumbnails');
            add_theme_support('automatic-feed-links');
            add_theme_support('title-tag');
            add_theme_support(
                'html5',
                [
                    'search-form',
                    'comment-form',
                    'comment-list',
                    'gallery',
                    'caption',
                    'script',
                    'style',
                ]
            );
            add_theme_support(
                'custom-logo',
                [
                    'height' => 100,
                    'width' => 350,
                    'flex-height' => true,
                    'flex-width' => true,
                ]
            );
            add_theme_support('align-wide');
            add_theme_support('responsive-embeds');

            /*
             * Editor Styles
             */
            add_theme_support('editor-styles');
            add_editor_style('editor-styles.css');

            /*
             * WooCommerce.
             */
            if (apply_filters('hello_elementor_add_woocommerce_support', true)) {
                // WooCommerce in general.
                add_theme_support('woocommerce');
                // Enabling WooCommerce product gallery features (are off by default since WC 3.0.0).
                // zoom.
                add_theme_support('wc-product-gallery-zoom');
                // lightbox.
                add_theme_support('wc-product-gallery-lightbox');
                // swipe.
                add_theme_support('wc-product-gallery-slider');
            }
        }
    }
}
add_action('after_setup_theme', 'hello_elementor_setup');

function hello_maybe_update_theme_version_in_db()
{
    $theme_version_option_name = 'hello_theme_version';
    // The theme version saved in the database.
    $hello_theme_db_version = get_option($theme_version_option_name);

    // If the 'hello_theme_version' option does not exist in the DB, or the version needs to be updated, do the update.
    if (!$hello_theme_db_version || version_compare($hello_theme_db_version, HELLO_ELEMENTOR_VERSION, '<')) {
        update_option($theme_version_option_name, HELLO_ELEMENTOR_VERSION);
    }
}

if (!function_exists('hello_elementor_display_header_footer')) {
    /**
     * Check whether to display header footer.
     *
     * @return bool
     */
    function hello_elementor_display_header_footer()
    {
        $hello_elementor_header_footer = true;

        return apply_filters('hello_elementor_header_footer', $hello_elementor_header_footer);
    }
}

if (!function_exists('hello_elementor_scripts_styles')) {
    /**
     * Theme Scripts & Styles.
     *
     * @return void
     */
    function hello_elementor_scripts_styles()
    {
        $min_suffix = defined('SCRIPT_DEBUG') && SCRIPT_DEBUG ? '' : '.min';

        if (apply_filters('hello_elementor_enqueue_style', true)) {
            wp_enqueue_style(
                'hello-elementor',
                get_template_directory_uri() . '/style' . $min_suffix . '.css',
                [],
                HELLO_ELEMENTOR_VERSION
            );
        }

        if (apply_filters('hello_elementor_enqueue_theme_style', true)) {
            wp_enqueue_style(
                'hello-elementor-theme-style',
                get_template_directory_uri() . '/theme' . $min_suffix . '.css',
                [],
                HELLO_ELEMENTOR_VERSION
            );
        }

        if (hello_elementor_display_header_footer()) {
            wp_enqueue_style(
                'hello-elementor-header-footer',
                get_template_directory_uri() . '/header-footer' . $min_suffix . '.css',
                [],
                HELLO_ELEMENTOR_VERSION
            );
        }
    }
}
add_action('wp_enqueue_scripts', 'hello_elementor_scripts_styles');

if (!function_exists('hello_elementor_register_elementor_locations')) {
    /**
     * Register Elementor Locations.
     *
     * @param ElementorPro\Modules\ThemeBuilder\Classes\Locations_Manager $elementor_theme_manager theme manager.
     *
     * @return void
     */
    function hello_elementor_register_elementor_locations($elementor_theme_manager)
    {
        if (apply_filters('hello_elementor_register_elementor_locations', true)) {
            $elementor_theme_manager->register_all_core_location();
        }
    }
}
add_action('elementor/theme/register_locations', 'hello_elementor_register_elementor_locations');

if (!function_exists('hello_elementor_content_width')) {
    /**
     * Set default content width.
     *
     * @return void
     */
    function hello_elementor_content_width()
    {
        $GLOBALS['content_width'] = apply_filters('hello_elementor_content_width', 800);
    }
}
add_action('after_setup_theme', 'hello_elementor_content_width', 0);

if (!function_exists('hello_elementor_add_description_meta_tag')) {
    /**
     * Add description meta tag with excerpt text.
     *
     * @return void
     */
    function hello_elementor_add_description_meta_tag()
    {
        if (!apply_filters('hello_elementor_description_meta_tag', true)) {
            return;
        }

        if (!is_singular()) {
            return;
        }

        $post = get_queried_object();
        if (empty($post->post_excerpt)) {
            return;
        }

        echo '<meta name="description" content="' . esc_attr(wp_strip_all_tags($post->post_excerpt)) . '">' . "\n";
    }
}
add_action('wp_head', 'hello_elementor_add_description_meta_tag');

// Admin notice
if (is_admin()) {
    require get_template_directory() . '/includes/admin-functions.php';
}

// Settings page
require get_template_directory() . '/includes/settings-functions.php';

// Header & footer styling option, inside Elementor
require get_template_directory() . '/includes/elementor-functions.php';

if (!function_exists('hello_elementor_customizer')) {
    // Customizer controls
    function hello_elementor_customizer()
    {
        if (!is_customize_preview()) {
            return;
        }

        if (!hello_elementor_display_header_footer()) {
            return;
        }

        require get_template_directory() . '/includes/customizer-functions.php';
    }
}
add_action('init', 'hello_elementor_customizer');

if (!function_exists('hello_elementor_check_hide_title')) {
    /**
     * Check whether to display the page title.
     *
     * @param bool $val default value.
     *
     * @return bool
     */
    function hello_elementor_check_hide_title($val)
    {
        if (defined('ELEMENTOR_VERSION')) {
            $current_doc = Elementor\Plugin::instance()->documents->get(get_the_ID());
            if ($current_doc && 'yes' === $current_doc->get_settings('hide_title')) {
                $val = false;
            }
        }
        return $val;
    }
}
add_filter('hello_elementor_page_title', 'hello_elementor_check_hide_title');

/**
 * BC:
 * In v2.7.0 the theme removed the `hello_elementor_body_open()` from `header.php` replacing it with `wp_body_open()`.
 * The following code prevents fatal errors in child themes that still use this function.
 */
if (!function_exists('hello_elementor_body_open')) {
    function hello_elementor_body_open()
    {
        wp_body_open();
    }
}

// Helper: Convert ISO country code to flag emoji (e.g. US → 🇺🇸)
if (!function_exists('br_get_flag_emoji')) {
    function br_get_flag_emoji($country_code)
    {
        $country_code = strtoupper($country_code);
        $emoji = '';
        for ($i = 0; $i < strlen($country_code); $i++) {
            $emoji .= mb_chr(0x1F1E6 - 65 + ord($country_code[$i]));
        }
        return $emoji;
    }
}

// Shortcode: [simple_add_to_cart id="123"]
function simple_add_to_cart_shortcode($atts)
{
    $atts = shortcode_atts(array(
        'id' => 0,
    ), $atts, 'simple_add_to_cart');

    $product_id = absint($atts['id']);
    if (!$product_id)
        return '';

    $product = wc_get_product($product_id);
    if (!$product || !$product->is_purchasable() || !$product->is_in_stock())
        return '';

    // ✅ Get WooCommerce's current shipping country (falls back to US if none set)
    $current_country = WC()->customer ? WC()->customer->get_shipping_country() : '';
    if (empty($current_country)) {
        $current_country = 'US';
    }

    // Build country dropdown, selecting current_country instead of hard-coding US
    $shipping_countries = WC()->countries->get_shipping_countries();
    $country_options = '';
    foreach ($shipping_countries as $code => $name) {
        $flag = br_get_flag_emoji($code);
        $selected = (strtoupper($code) === strtoupper($current_country)) ? ' selected' : '';
        $country_options .= sprintf(
            '<option value="%s"%s>%s %s</option>',
            esc_attr(strtolower($code)),
            $selected,
            esc_html($flag),
            esc_html($name)
        );
    }

    ob_start(); ?>
    <form id="homepage-add-to-cart-form" style="margin-top: 1rem; display: block;">

        <div class="country-label" style="display:block; width:100%; margin-bottom: 0.5rem;">
            <label for="homepage-country-select" style="font-weight: 600; color:#BBB; font-size: 1rem; display: block;">
                Select Shipping Country:
            </label>
        </div>

        <div class="cart-flex-row"
            style="display: flex; flex-direction: row; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap;">
            <div style="flex: 1 1 100%;">
                <select id="homepage-country-select" name="homepage-country"
                    style="width:100%; padding: 0.4rem; background-color:#121D25; color:#BBB;">
                    <?php echo $country_options; ?>
                </select>
            </div>


            <div class="quantity-wrapper" style="display: flex; flex-direction: column; align-items: center;">
                <label for="homepage-quantity" style="font-size: 0.8rem; margin-bottom: 0.2rem; color:#FFF;">
                    Qty
                </label>
                <input id="homepage-quantity" type="number" name="quantity" value="1" min="1" max="12" step="1"
                    style="width: 70px; text-align: center; padding: 0.4rem; background-color: #121D25; color:#FFF;" />
            </div>

            <button type="submit" class="add_to_cart_button" id="homepage_cart_button"
                style="padding: 0.5rem 1rem; align-self: flex-end;">
                Add to Cart
            </button>
        </div>

        <?php wp_nonce_field('woocommerce-cart'); ?>
    </form>

    <script>
        jQuery(function ($) {
            var mapping = window.brCountryMapping || {};
            var $countrySelect = $('#homepage-country-select');
            var $cartButton = $('#homepage_cart_button');

            function setSessionForCountry(val) {
                if (!val || !mapping[val]) {
                    return $.Deferred().resolve().promise();
                }
                return $.post('<?php echo admin_url('admin-ajax.php'); ?>', {
                    action: 'set_country_currency',
                    country: mapping[val].country
                });
            }

            // ✅ Now defaultVal will reflect Woo's session country
            var defaultVal = $countrySelect.val();
            if (defaultVal && mapping[defaultVal]) {
                $cartButton.prop('disabled', false).css('opacity', 1);
                setSessionForCountry(defaultVal);
            } else {
                $cartButton.prop('disabled', true).css('opacity', 0.6);
            }

            $countrySelect.on('change', function () {
                var val = $(this).val();
                if (!val || !mapping[val]) {
                    $cartButton.prop('disabled', true).css('opacity', 0.6);
                    return;
                }
                $cartButton.prop('disabled', false).css('opacity', 1);
                setSessionForCountry(val);
            });

            $('#homepage-add-to-cart-form').on('submit', function (e) {
                e.preventDefault();
                var qty = $('#homepage-quantity').val() || 1;
                var val = $('#homepage-country-select').val();
                var country = (mapping[val] && mapping[val].country) ? mapping[val].country : '';
                var currency = (mapping[val] && mapping[val].currency) ? mapping[val].currency : '';

                $.post(
                    wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'add_to_cart'),
                    {
                        product_id: <?php echo json_encode($product_id); ?>,
                    quantity: qty,
                    _wpnonce: $('input[name="_wpnonce"]').val()
                        }
            ).done(function () {
                var url = '<?php echo esc_url(wc_get_checkout_url()); ?>';
                var sep = url.indexOf('?') === -1 ? '?' : '&';
                if (country) { url += sep + 'br_country=' + encodeURIComponent(country); sep = '&'; }
                if (currency) {
                    url += sep + 'br_currency=' + encodeURIComponent(currency);
                    url += '&currency=' + encodeURIComponent(currency);
                }
                window.location.href = url;
            });
        });
            });
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('simple_add_to_cart', 'simple_add_to_cart_shortcode');


// Disable plugin auto-update email notifications
add_filter('auto_plugin_update_send_email', '__return_false');

/**
 * Show only the shipping address on the "Pay for Order" page
 */
add_action('template_redirect', function () {
    if (!function_exists('is_checkout_pay_page') || !is_checkout_pay_page())
        return;

    global $wp;
    $order = null;

    if (isset($wp->query_vars['order-pay'])) {
        $order_id = absint($wp->query_vars['order-pay']);
        $order = $order_id ? wc_get_order($order_id) : null;
    }
    if (!$order && !empty($_GET['key'])) {
        $order_id = wc_get_order_id_by_order_key(wc_clean(wp_unslash($_GET['key'])));
        $order = $order_id ? wc_get_order($order_id) : null;
    }
    if (!$order)
        return;

    $address_html = $order->get_formatted_shipping_address();
    if (empty($address_html))
        $address_html = $order->get_formatted_billing_address();
    if (empty($address_html))
        return;

    $block = '<div class="wc-order-pay-context" style="margin:1rem 0;padding:0.75rem 1rem;border:1px solid #ddd;background:#fafafa">';
    $block .= '<h2 style="margin:0 0 .5rem 0;">Shipping Address</h2>';
    $block .= '<div style="margin:.25rem 0;">' . wp_kses_post(wpautop($address_html)) . '</div>';
    $block .= '</div>';

    add_filter('the_content', function ($content) use ($block) {
        return $block . $content;
    }, 5);
});

/**
 * Shortcode: [custom_product_price]
 * Shows the product’s current price and adds region-aware VAT/currency notes.
 */
function custom_product_price_shortcode()
{

    if (!function_exists('WC'))
        return '';
    /**
     * Prevent fatal errors in Elementor preview & Vacation Mode:
     * If no WC Cart exists yet, do NOT run shipping logic.
     */
    if (!WC()->cart instanceof WC_Cart) {
        $fallback_product = wc_get_product(351); // your Winter product ID
        if ($fallback_product) {
            return sprintf(
                '<div id="product-price-block">
                    <h2 class="br-price" style="color:#C28E40; font-size:28px; font-weight:600; margin:0;">%s</h2>
                    <p class="br-subline" style="font-size:16px; color:#BBB; line-height:1.3; margin:4px 0 0;">
                        </p>
                </div>',
                $fallback_product->get_price_html()
            );
        }
        return '';
    }

    // Get the product (first product if single-product store)
    $product_id = 351;
    if (!$product_id) {
        $product_id = get_option('woocommerce_shop_page_id');
    }
    $product = wc_get_product($product_id);
    if (!$product)
        return '';

    // Core Woo price HTML
    $price_html = $product->get_price_html();
    $currency = get_woocommerce_currency();

    // Determine active country (billing → shipping → geolocate)
    $country = '';
    if (WC()->customer) {
        $country = strtoupper(
            WC()->customer->get_shipping_country() ?: WC()->customer->get_billing_country()
        );
    }
    if (!$country && class_exists('WC_Geolocation')) {
        $geo = WC_Geolocation::geolocate_ip();
        if (!empty($geo['country']))
            $country = strtoupper($geo['country']);
    }

    // Translation map for "Free shipping on 2+ rosins"
    $translations = [
        'FR' => '📦 Livraison gratuite dès 2 rosins',
        'DE' => '📦 Gratisversand ab 2 Kolophonien',
        'IT' => '📦 Spedizione gratuita con 2+ rosins',
        'ES' => '📦 Envío gratuito en pedidos de 2+ rosins',
        'PT' => '📦 Envio grátis em 2+ rosins',
        'NO' => '📦 Gratis frakt ved kjøp av 2+ rosins',
        'IS' => '📦 Ókeypis sending við kaup á 2+ rosins',
        'JP' => '📦 ロジン2個以上で送料無料',
        'KR' => '📦 로진 2개 이상 구매 시 무료 배송',
        'TW' => '📦 滿2個松香免運',
        'CN' => '📦 满2个松香免运费',
        'HK' => '📦 滿2個松香免運費',
        'DEFAULT' => '📦 Free shipping on 2+ rosins'
    ];

    $ship_msg = isset($translations[$country])
        ? $translations[$country]
        : $translations['DEFAULT'];

    // --- Build price and subline ---
    $price_style = 'color:#C28E40; font-size:28px; font-weight:600; margin:0;';
    $sub_style = 'font-size:16px; color:#BBB; line-height:1.3; margin:4px 0 0;';

    $currency_html = '';

    // Only show currency next to price for regions where it's helpful
    $skip_currency_display = ['USD', 'EUR', 'GBP', 'JPY', 'KRW'];

    if (!in_array($currency, $skip_currency_display, true)) {
        $currency_html = sprintf(
            ' <span style="font-size:16px; color:#BBB;">(%s)</span>',
            esc_html($currency)
        );
    } else {
        $currency_html = '';
    }


    // --- Region logic for subline ---
    if ($country === 'US') {
        $subline = 'Free&nbsp;shipping';
    } elseif (in_array($country, ['NO', 'SE'], true)) {
        $subline = 'VAT&nbsp;incl.&nbsp;&nbsp;' . esc_html($ship_msg);
    } elseif (
        in_array($country, [
            'AT',
            'BE',
            'BG',
            'HR',
            'CY',
            'CZ',
            'DK',
            'EE',
            'FI',
            'FR',
            'DE',
            'GR',
            'HU',
            'IE',
            'IT',
            'LV',
            'LT',
            'LU',
            'MT',
            'NL',
            'PL',
            'PT',
            'RO',
            'SK',
            'SI',
            'ES'
        ], true)
    ) {
        $subline = 'VAT&nbsp;incl.&nbsp;&nbsp;' . esc_html($ship_msg);
    } else {
        $subline = esc_html($ship_msg);
    }
    // --- Determine the shipping cost for a single rosin ---
    $shipping_cost = '';
    if (class_exists('WC_Shipping_Zones') && class_exists('WC_Shipping')) {
        $package = [
            'destination' => [
                'country' => $country,
                'state' => '',
                'postcode' => '',
                'city' => '',
            ],
            'contents' => [
                [
                    'data' => $product,
                    'quantity' => 1,
                ],
            ],
            'applied_coupons' => [],
            'user' => ['ID' => get_current_user_id()],
            'cart_subtotal' => (float) $product->get_price(),
        ];

        $shipping = new WC_Shipping();
        $shipping->calculate_shipping([$package]);

        $rates = $shipping->packages[0]['rates'] ?? [];
        if (!empty($rates)) {
            $first = reset($rates);
            $cost = floatval($first->cost);
            // Apply VAT multiplier for EU countries
            $eu_vat_rates = [
                'AT' => 1.20,
                'BE' => 1.21,
                'BG' => 1.20,
                'HR' => 1.25,
                'CY' => 1.19,
                'CZ' => 1.21,
                'DK' => 1.25,
                'EE' => 1.22,
                'FI' => 1.24,
                'FR' => 1.20,
                'DE' => 1.19,
                'GR' => 1.24,
                'HU' => 1.27,
                'IE' => 1.23,
                'IT' => 1.22,
                'LV' => 1.21,
                'LT' => 1.21,
                'LU' => 1.17,
                'MT' => 1.18,
                'NL' => 1.21,
                'PL' => 1.23,
                'PT' => 1.23,
                'RO' => 1.19,
                'SK' => 1.20,
                'SI' => 1.22,
                'ES' => 1.21,
                'SE' => 1.25,
                'NO' => 1.25,
            ];

            if (isset($eu_vat_rates[$country])) {
                $cost *= $eu_vat_rates[$country];
            }


            if ($cost > 0) {
                $shipping_cost = wc_price($cost, ['currency' => $currency]);
            } else {
                $shipping_cost = 'Free';
            }
        }
    }

    // --- Build the text line ---
    if ($shipping_cost === 'Free') {
        // Simple free shipping line
        $subline = 'Free&nbsp;shipping';
    } else {
        // Include VAT info for EU / NO / SE
        $show_vat = in_array($country, [
            'AT',
            'BE',
            'BG',
            'HR',
            'CY',
            'CZ',
            'DK',
            'EE',
            'FI',
            'FR',
            'DE',
            'GR',
            'HU',
            'IE',
            'IT',
            'LV',
            'LT',
            'LU',
            'MT',
            'NL',
            'PL',
            'PT',
            'RO',
            'SK',
            'SI',
            'ES',
            'SE',
            'NO'
        ], true);

        if ($show_vat) {
            $subline = sprintf(
                'VAT&nbsp;incl.&nbsp;&nbsp;%s&nbsp;shipping&nbsp;&mdash;&nbsp;free&nbsp;with&nbsp;2+&nbsp;rosins',
                $shipping_cost
            );
        } else {
            $subline = sprintf(
                '%s&nbsp;shipping&nbsp;&mdash;&nbsp;free&nbsp;with&nbsp;2+&nbsp;rosins',
                $shipping_cost
            );
        }
    }
    $guarantee_html = do_shortcode('[bassment_return_policy_link]');
    // Output final block
    return sprintf(
        '<div id="product-price-block" data-baseusd="%s">
			<h2 class="br-price" style="%s">%s%s</h2>
			<p class="br-subline" style="%s">%s</p>
			%s
		</div>',
        esc_attr($product->get_price()), // pass numeric base price to JS
        esc_attr($price_style),
        $price_html,
        $currency_html,
        esc_attr($sub_style),
        $subline,
        $guarantee_html
    );
}
add_shortcode('custom_product_price', 'custom_product_price_shortcode');


/**
 * Always keep catalog prices gross for US/CA.
 */
add_filter('woocommerce_adjust_non_base_location_prices', '__return_false');


// Force Woo to always use shipping address for tax + shipping calculations if set
add_filter('woocommerce_customer_get_taxable_address', function ($address, $customer) {
    $ship_to_diff = WC()->checkout ? WC()->checkout->get_value('ship_to_different_address') : false;

    if ($ship_to_diff || $customer->get_shipping_country()) {
        return [
            $customer->get_shipping_country(),
            $customer->get_shipping_state(),
            $customer->get_shipping_postcode(),
            $customer->get_shipping_city(),
        ];
    }

    return $address;
}, 10, 2);

/**
 * Helper: get current taxable country/state safely.
 */

function br_get_taxable_cc()
{
    $country = $state = '';
    if (WC()->customer) {
        $addr = WC()->customer->get_taxable_address(); // [country, state, postcode, city]
        $country = $addr[0] ?? '';
        $state = $addr[1] ?? '';
    }
    // During AJAX, prefer posted values
    if (isset($_POST['shipping_country']) && $_POST['shipping_country'] !== '') {
        $country = strtoupper(wc_clean(wp_unslash($_POST['shipping_country'])));
    } elseif (isset($_POST['billing_country']) && $_POST['billing_country'] !== '') {
        $country = strtoupper(wc_clean(wp_unslash($_POST['billing_country'])));
    }
    if (isset($_POST['shipping_state']) && $_POST['shipping_state'] !== '') {
        $state = strtoupper(wc_clean(wp_unslash($_POST['shipping_state'])));
    } elseif (isset($_POST['billing_state']) && $_POST['billing_state'] !== '') {
        $state = strtoupper(wc_clean(wp_unslash($_POST['billing_state'])));
    }
    return [$country, $state];
}

/**
 * Treat Canada + NJ as exclusive tax zones.
 */
add_filter('woocommerce_prices_include_tax', function ($include_tax) {
    if (is_admin() && !wp_doing_ajax())
        return $include_tax;
    list($country, $state) = br_get_taxable_cc();
    if ($country === 'CA' || ($country === 'US' && $state === 'NJ'))
        return false;
    return $include_tax;
}, 20);

/**
 * Show net subtotals in cart/checkout for US/CA.
 */
add_filter('woocommerce_cart_item_subtotal', function ($subtotal_html, $cart_item) {
    list($country, $state) = br_get_taxable_cc();
    if ($country === 'CA' || $country === 'US') {
        $net = wc_get_price_excluding_tax($cart_item['data'], ['qty' => $cart_item['quantity']]);
        return wc_price($net);
    }
    return $subtotal_html;
}, 20, 2);

add_filter('woocommerce_cart_subtotal', function ($subtotal_html, $compound, $cart) {
    list($country, $state) = br_get_taxable_cc();
    if ($country === 'CA' || $country === 'US')
        return wc_price($cart->get_subtotal());
    return $subtotal_html;
}, 20, 3);

/**
 * Show shipping cost net of tax for US/CA.
 */
add_filter('woocommerce_cart_shipping_method_full_label', function ($label, $method) {
    list($country, $state) = br_get_taxable_cc();

    if ($country === 'US') {
        // ✅ US: Always hide the price, just show "Free shipping"
        $label = $method->get_label();
    } elseif ($country === 'CA') {
        // ✅ CA: Still show shipping price net of tax
        $cost = (float) $method->cost;
        if (is_array($method->taxes) && array_sum($method->taxes) > 0) {
            $cost -= array_sum($method->taxes);
        }
        $label = sprintf('%s: %s', $method->get_label(), wc_price($cost));
    }

    return $label;
}, 20, 2);


/* -----------------------------------------------------------------------------
 * PERSIST CHECKOUT FIELDS ACROSS EAS/WOO REFRESHES (SERVER-SIDE, NO LOOPS)
 * -------------------------------------------------------------------------- */

/**
 * 1) On every checkout refresh, capture posted billing/shipping fields
 *    and the "ship to different address" checkbox into WC session.
 */
add_action('woocommerce_checkout_update_order_review', function ($post_data) {
    if (!WC()->session)
        return;
    $posted = [];
    wp_parse_str($post_data, $posted);

    // Keep only what we care about.
    $keep = [];
    foreach ($posted as $k => $v) {
        if (preg_match('/^(billing_|shipping_)/', $k) || $k === 'ship_to_different_address') {
            $keep[$k] = is_array($v) ? array_map('wc_clean', wp_unslash($v)) : wc_clean(wp_unslash($v));
        }
    }

    WC()->session->set('br_cached_fields', $keep);

    // Also persist into the customer object so Woo defaults line up on next render.
    if (WC()->customer) {
        if (!empty($keep['billing_country']))
            WC()->customer->set_billing_country($keep['billing_country']);
        if (!empty($keep['billing_state']))
            WC()->customer->set_billing_state($keep['billing_state']);
        if (!empty($keep['billing_postcode']))
            WC()->customer->set_billing_postcode($keep['billing_postcode']);
        if (!empty($keep['billing_city']))
            WC()->customer->set_billing_city($keep['billing_city']);
        if (!empty($keep['shipping_country']))
            WC()->customer->set_shipping_country($keep['shipping_country']);
        if (!empty($keep['shipping_state']))
            WC()->customer->set_shipping_state($keep['shipping_state']);
        if (!empty($keep['shipping_postcode']))
            WC()->customer->set_shipping_postcode($keep['shipping_postcode']);
        if (!empty($keep['shipping_city']))
            WC()->customer->set_shipping_city($keep['shipping_city']);
        WC()->customer->save();
    }
}, 10, 1);
/**
 * 2) When Woo renders fields, prefer posted values, else our session cache.
 *    Run late (priority 99) so we override Woo defaults if needed.
 */
add_filter('woocommerce_checkout_get_value', function ($value, $input) {
    // First: respect anything just posted in this request
    if (isset($_POST[$input])) {
        return wc_clean(wp_unslash($_POST[$input]));
    }

    // Then: use our cached values from session if available
    if (WC()->session) {
        $cache = WC()->session->get('br_cached_fields');
        if (is_array($cache) && array_key_exists($input, $cache)) {
            return $cache[$input];
        }
    }

    // Fallback: whatever Woo had as the default
    return $value;
}, 99, 2); // <-- ✅ now runs after other filters


/**
 * 3) Keep the "Ship to a different address" checkbox consistent.
 */
add_filter('woocommerce_ship_to_different_address_checked', function ($checked) {
    if (isset($_POST['ship_to_different_address'])) {
        return (bool) $_POST['ship_to_different_address'];
    }
    if (WC()->session) {
        $cache = WC()->session->get('br_cached_fields');
        if (is_array($cache) && isset($cache['ship_to_different_address'])) {
            return (bool) $cache['ship_to_different_address'];
        }
    }
    return $checked;
}, 10, 1);

/* -----------------------------------------------------------------------------
 * PAYMENT GATEWAYS (CURRENCY-AWARE, NO COOKIE DEPENDENCIES)
 * -------------------------------------------------------------------------- */

// Reorder gateways: SEPA/BACS first only for DE, AT, NO, SE
add_filter('woocommerce_available_payment_gateways', function ($gateways) {
    if (!is_checkout() || is_admin()) {
        return $gateways;
    }

    $country = WC()->customer ? WC()->customer->get_billing_country() : '';
    $preferred = ['DE', 'AT', 'NO', 'SE'];

    if (in_array($country, $preferred, true) && isset($gateways['bacs'])) {
        $ordered = ['bacs' => $gateways['bacs']];

        if (isset($gateways['woocommerce_payments'])) {
            $ordered['woocommerce_payments'] = $gateways['woocommerce_payments'];
        }

        foreach ($gateways as $id => $gw) {
            if (isset($ordered[$id]))
                continue;
            $ordered[$id] = $gw;
        }

        return $ordered;
    }

    // fallback → WooPayments first if present
    if (isset($gateways['woocommerce_payments'])) {
        $ordered = ['woocommerce_payments' => $gateways['woocommerce_payments']];
        foreach ($gateways as $id => $gw) {
            if ($id === 'woocommerce_payments')
                continue;
            $ordered[$id] = $gw;
        }
        return $ordered;
    }

    return $gateways;
}, 20);
add_action('wp_footer', function () {
    if (!is_checkout())
        return; ?>
    <script>
        jQuery(function ($) {
            function selectPreferredGateway() {
                var country = $('#billing_country').val() || $('#shipping_country').val() || '';
                var $bacs = $('input[name="payment_method"][value="bacs"]');
                var $woopay = $('input[name="payment_method"][value="woocommerce_payments"]');
                var $current = $('input[name="payment_method"]:checked');
                var desired = null;

                if (['DE', 'AT', 'NO', 'SE'].includes(country) && $bacs.length) {
                    desired = $bacs;
                } else if ($woopay.length) {
                    desired = $woopay;
                }

                if (desired && (!$current.length || desired.val() !== $current.val())) {
                    $('.wc_payment_methods .payment_box').hide(); // hide all boxes
                    desired.prop('checked', true).trigger('change'); // this will open the right one
                }
            }

            selectPreferredGateway();
            $(document.body).on('updated_checkout', selectPreferredGateway);
            $('form.checkout').on('change', '#billing_country, #shipping_country', function () {
                setTimeout(selectPreferredGateway, 50);
            });
        });
    </script>
<?php });


/**
 * Move country fields to top of billing/shipping sections.
 */
add_filter('woocommerce_checkout_fields', function ($fields) {
    if (isset($fields['billing']['billing_country']))
        $fields['billing']['billing_country']['priority'] = 5;
    if (isset($fields['billing']['billing_first_name']))
        $fields['billing']['billing_first_name']['priority'] = 10;
    if (isset($fields['billing']['billing_last_name']))
        $fields['billing']['billing_last_name']['priority'] = 20;

    if (isset($fields['shipping']['shipping_country']))
        $fields['shipping']['shipping_country']['priority'] = 5;
    if (isset($fields['shipping']['shipping_first_name']))
        $fields['shipping']['shipping_first_name']['priority'] = 10;
    if (isset($fields['shipping']['shipping_last_name']))
        $fields['shipping']['shipping_last_name']['priority'] = 20;

    return $fields;
});

/**
 * Ensure tax recalculates when billing state changes.
 */
add_action('wp_enqueue_scripts', function () {
    if (is_checkout() && !is_order_received_page()) {
        wp_add_inline_script('wc-checkout', "jQuery(function($){ $('form.checkout').on('change', '#billing_state', function(){ $('body').trigger('update_checkout'); }); });");
    }
});

/**
 * 1) Add Woo native currency switcher markup above checkout form.
 *    This uses WooPayments’ own session + AJAX logic.
 */
add_action('woocommerce_before_checkout_form', function () {
    if (function_exists('wc_get_currency_switcher_markup')) {
        echo '<div class="br-currency-switcher" id="br-currency-switcher" style="margin-bottom:1rem; padding:0.75rem; max-width:400px; border:1px solid #ddd; background:#ffe1b3;">';
        echo '<label style="font-weight:600; display:block; margin-bottom:0.5rem;">Choose Your Checkout Currency:</label>';
        echo wc_get_currency_switcher_markup([
            'symbol' => true, // show symbol
            'flag' => true  // show flags
        ]);
        echo '<p style="font-size:0.85rem; color:#555; margin-top:0.5rem;">Please choose your currency before filling in billing details.</p>';
        echo '</div>';
        ?>
        <script>
            jQuery(function ($) {
                function sortAndRewriteOptions() {
                    var $sel = $('#br-currency-switcher').find('select').first();
                    if (!$sel.length) return;

                    var opts = $sel.find('option').get();
                    var current = $sel.val();

                    opts.forEach(function (opt) {
                        var $opt = $(opt);
                        var text = $opt.text().trim();

                        // Try to extract pieces: flag, symbol, code
                        // Woo outputs something like "🇸🇪 kr SEK" or "🇸🇪 SEK kr"
                        // We'll normalize to "🇸🇪 SEK kr"
                        var flagMatch = text.match(/^[^\w]+/); // emojis/symbols at start
                        var codeMatch = text.match(/\b[A-Z]{3}\b/);
                        var symbolMatch = text.match(/[$€¥₩₤₱₽₹₺₿]|kr|zł|₫|₦|₴|₸|R\$/i);

                        var flag = flagMatch ? flagMatch[0].trim() : '';
                        var code = codeMatch ? codeMatch[0].trim() : '';
                        var symbol = symbolMatch ? symbolMatch[0].trim() : '';

                        $opt.text([flag, code, symbol].filter(Boolean).join(' '));
                    });

                    // Sort alphabetically by option value (ISO code)
                    opts.sort(function (a, b) {
                        var A = ($(a).val() || '').toUpperCase();
                        var B = ($(b).val() || '').toUpperCase();
                        return A.localeCompare(B);
                    });

                    $sel.empty().append(opts);
                    if (current) $sel.val(current);
                }

                // On load + whenever Woo refreshes checkout fragments
                sortAndRewriteOptions();
                $(document.body).on('updated_checkout', sortAndRewriteOptions);
            });
        </script>
        <?php
    }
}, 5);


/**
 * 2) Force Woo to use the selected currency on every fragment refresh.
 */
add_filter('woocommerce_currency', function ($currency) {
    if (WC()->session) {
        $sel = WC()->session->get('wcpay_multi_currency_selected_currency');
        if ($sel && is_string($sel)) {
            return strtoupper($sel);
        }
    }
    return $currency;
}, 9999);

add_filter('wc_price_args', function ($args) {
    if (WC()->session) {
        $sel = WC()->session->get('wcpay_multi_currency_selected_currency');
        if ($sel && is_string($sel)) {
            $args['currency'] = strtoupper($sel);
        }
    }
    return $args;
}, 9999);


/**
 * Force Canada orders to save as EX-tax and treat displayed price as NET.
 * Classic (shortcode) checkout only.
 */
// 1) Disable the “convert to net & recalc” path for all regions
function br_is_exclusive_zone_from_order(WC_Order $order): bool
{
    return false; // don’t run the rewrite anywhere
}

add_action('woocommerce_checkout_order_created', function ($order) {
    if (!$order instanceof WC_Order)
        return;
    if (!br_is_exclusive_zone_from_order($order))
        return;

    // 1) Per-order pricing mode = exclusive
    if (method_exists($order, 'set_prices_include_tax')) {
        $order->set_prices_include_tax(false);    // writes _prices_include_tax
    }
    $order->update_meta_data('_prices_include_tax', 'no');    // belt & suspenders

    // 2) For each product line: make Woo treat current displayed price as NET
    foreach ($order->get_items('line_item') as $item_id => $item) {
        $current_net = (float) $item->get_total();        // what Woo thinks is net (after extracting tax)
        $current_tax = (float) $item->get_total_tax();    // taxes Woo computed when it thought prices were gross
        $want_net = $current_net + $current_tax;       // this is your displayed $62.50 per qty (in CAD)

        // Set both subtotal & total to "net" = displayed price; clear any tax carried over
        $item->set_subtotal($want_net);
        $item->set_total($want_net);
        $item->set_subtotal_tax(0);
        $item->set_total_tax(0);
        $item->save();
    }

    // (If you ever charge shipping with tax in CA, also clear & let Woo recalc)
    foreach ($order->get_items('shipping') as $ship) {
        // $ship->set_total() unchanged for Free shipping; ensure no stale taxes
        $ship->set_taxes([]);
        $ship->save();
    }

    // 3) Recalculate taxes/totals from clean slate and save
    $order->calculate_totals(true);
    $order->save();
}, 20);

/**
 * Show NET (ex-tax) amounts on Thank-You/emails/admin for CA (and US/NJ if your helper does that).
 * Uses your existing br_is_exclusive_zone_from_order( $order ).
 */

/**
 * Thank-You / Emails / Admin: force NET (ex-tax) for the line-item "Total" cell.
 * This specifically overrides get_formatted_line_subtotal().
 */
add_filter('woocommerce_order_formatted_line_subtotal', function ($formatted, $item, $order, $plain_text = false) {
    if (!$order instanceof WC_Order)
        return $formatted;
    if (!function_exists('br_is_exclusive_zone_from_order') || !br_is_exclusive_zone_from_order($order)) {
        return $formatted;
    }

    // After your recalc, $item->get_total() is the NET line total (qty already applied).
    $net_line_total = (float) $item->get_total();

    return wc_price($net_line_total, ['currency' => $order->get_currency()]);
}, 20, 4);


/* 2) “Subtotal” row → force NET (ex-tax) from the stored order subtotal */
add_filter('woocommerce_get_order_item_totals', function ($totals, $order, $tax_display) {
    if (!$order instanceof WC_Order)
        return $totals;
    if (!function_exists('br_is_exclusive_zone_from_order') || !br_is_exclusive_zone_from_order($order)) {
        return $totals;
    }

    if (isset($totals['cart_subtotal'])) {
        // $order->get_subtotal() is NET (ex-tax) for all items (after discounts).
        $totals['cart_subtotal']['value'] = wc_price($order->get_subtotal(), ['currency' => $order->get_currency()]);
    }
    return $totals;
}, 20, 3);


// Dynamic shipping to show expedited option
add_filter('woocommerce_package_rates', function ($rates, $package) {
    if (empty($rates))
        return $rates;

    // List of countries where ALL paid rates (Standard/Express) should be hidden
    // when Free Shipping is available. Add more country codes (e.g., 'US', 'CA') here as needed.
    $no_paid_upsell_countries = ['DE', 'BE', 'DK', 'ES', 'FI', 'FR', 'GR', 'IE', 'IT', 'LU', 'NL', 'PT', 'SE', 'NO'];

    // Get the destination country safely
    $country = $package['destination']['country'] ?? '';

    $free_shipping_exists = false;
    $express_rates = [];
    $standard_keys = [];

    // First pass: detect free shipping and classify rates
    foreach ($rates as $key => $rate) {
        if ($rate->method_id === 'free_shipping') {
            $free_shipping_exists = true;
        }
        if ($rate->method_id === 'flat_rate' && stripos($rate->label, 'Express') !== false) {
            $express_rates[$key] = $rate;
        }
        if ($rate->method_id === 'flat_rate' && stripos($rate->label, 'Express') === false) {
            $standard_keys[] = $key;
        }
    }

    // If free shipping exists 
    if ($free_shipping_exists) {

        // === START CUSTOM LOGIC FOR NO-UPSELL COUNTRIES ===
        if (in_array($country, $no_paid_upsell_countries)) {
            // If Free Shipping is active for these countries, remove ALL Flat Rates
            foreach ($rates as $key => $rate) {
                if ($rate->method_id === 'flat_rate') {
                    unset($rates[$key]);
                }
            }
            // Return rates immediately after the targeted removal
            return $rates;
        }
        // === END CUSTOM LOGIC ===

        // (Original logic for non-exempt countries continues below)

        // Hide all Standard rates
        foreach ($standard_keys as $k) {
            unset($rates[$k]);
        }

        // If multiple express rates exist, keep the cheapest one only
        if (count($express_rates) > 1) {
            // Sort express rates by cost ascending
            uasort($express_rates, function ($a, $b) {
                return $a->cost <=> $b->cost;
            });

            $cheapest_key = array_key_first($express_rates);
            foreach ($express_rates as $key => $rate) {
                if ($key !== $cheapest_key)
                    unset($rates[$key]);
            }
        }
    } else {
        // No free shipping: keep only the most expensive express (full price)
        if (count($express_rates) > 1) {
            uasort($express_rates, function ($a, $b) {
                return $b->cost <=> $a->cost; // highest first
            });

            $expensive_key = array_key_first($express_rates);
            foreach ($express_rates as $key => $rate) {
                if ($key !== $expensive_key)
                    unset($rates[$key]);
            }
        }
    }

    return $rates;
}, 50, 2);


// Straight to checkout redirect
add_filter('woocommerce_add_to_cart_redirect', 'br_skip_cart_redirect_checkout');
function br_skip_cart_redirect_checkout($url)
{
    return wc_get_checkout_url();
}

add_action('wp_head', function () {
    if (is_checkout()): ?>
        <style>
            .woocommerce-message .button.wc-forward {
                display: none !important;
            }
        </style>
    <?php endif;
});

// Hide express checkout unless USA or Canada
/**
 * Allow Woo's logic to decide availability, but never show express buttons
 * until after a country has been selected AND it's US/CA.
 */
// Hide express checkout unless allowed by our session flag
add_filter('woocommerce_payment_request_is_available', function ($available) {
    if (!WC()->session)
        return false;

    // Read the flag we already set in br_set_country_only_ajax
    $flag = WC()->session->get('br_allow_express');

    // Default to "no" if not set yet
    if ($flag !== 'yes') {
        return false;
    }

    return $available;
}, 20);



/**
 * Get the current shipping country from WooCommerce's active package.
 */
function br_has_shipping_rates(): bool
{
    // If no shipping needed (virtual product), treat as "has rates"
    if (WC()->cart && !WC()->cart->needs_shipping()) {
        return true;
    }

    $packages = WC()->shipping()->get_packages();
    if (empty($packages)) {
        // No packages yet → don't block checkout, let Woo refresh first
        return true;
    }

    foreach ($packages as $package) {
        if (!empty($package['rates'])) {
            return true;
        }
    }
    return false;
}

function br_get_country_name(): string
{
    $packages = WC()->shipping()->get_packages();
    if (empty($packages))
        return '';

    $code = strtoupper($packages[0]['destination']['country'] ?? '');
    if (!$code)
        return '';
    $countries = WC()->countries->get_countries();
    return $countries[$code] ?? $code;
}


/**
 * Show custom notice at top of checkout
 */
add_action('woocommerce_before_checkout_form', function () {
    $country_name = br_get_country_name();
    if (!$country_name)
        return;

    if (!br_has_shipping_rates()) {
        $msg = 'For shipping to ' . esc_html($country_name) .
            ', please email <a href="mailto:bassmentrosin@gmail.com">bassmentrosin@gmail.com</a> ' .
            'with your name, address, and number of rosins.';
        wc_print_notice($msg, 'error');
    }
}, 5);

/**
 * Replace message in the shipping totals row
 */
add_filter('woocommerce_no_shipping_available_html', function ($message) {
    $country_name = br_get_country_name();
    if (!$country_name || br_has_shipping_rates())
        return $message;

    return '<p class="custom-shipping-message">For shipping to ' . esc_html($country_name) .
        ', please email <a href="mailto:bassmentrosin@gmail.com">bassmentrosin@gmail.com</a> ' .
        'with your name, address, and number of rosins.</p>';
}, 20);

/**
 * Block checkout submission entirely if no shipping rates exist
 */
add_action('woocommerce_checkout_process', function () {
    if (!br_has_shipping_rates()) {
        $country_name = br_get_country_name();
        $msg = $country_name
            ? 'Automatic checkout is yet available for ' . esc_html($country_name) . ', please email <a href="mailto:bassmentrosin@gmail.com">bassmentrosin@gmail.com</a> with your name, address, and number of rosins.'
            : 'We cannot complete checkout because shipping is unavailable. Please email <a href="mailto:bassmentrosin@gmail.com">bassmentrosin@gmail.com</a> to place your order.';
        wc_add_notice($msg, 'error');
    }
});

/**
 * Hide payment methods if no shipping rates exist
 */
add_filter('woocommerce_available_payment_gateways', function ($gateways) {
    return br_has_shipping_rates() ? $gateways : array();
});

/**
 * Suppress WooCommerce's default error messages
 */
add_filter('woocommerce_add_error', function ($error) {
    $check = strtolower(wp_strip_all_tags($error));
    if (str_contains($check, 'unfortunately we do not ship to'))
        return '';
    if ($check === strtolower(__('invalid payment method.', 'woocommerce')))
        return '';
    return $error;
}, 20);

add_action('wp_footer', function () {
    if (!is_checkout())
        return;
    ?>
    <script>
        jQuery(function ($) {
            function showNoShippingNotice() {
                // Remove any existing notice
                $('.br-country-notice').remove();

                // Check if Woo's shipping section currently shows "no shipping"
                var shippingText = $('.woocommerce-shipping-totals, .woocommerce-shipping-destination').text();
                if (shippingText.match(/no shipping|not ship/i)) {
                    var country = $('#billing_country').val() || $('#shipping_country').val() || '';
                    var countryName = country ? $('#billing_country option[value="' + country + '"]').text() : 'your country';

                    var message = '<div class="woocommerce-error br-country-notice" style="margin-bottom:1em;">' +
                        'Automatic checkout is yet available for ' + countryName +
                        ', please email <a href="mailto:bassmentrosin@gmail.com">bassmentrosin@gmail.com</a> ' +
                        'with your name, address, and number of rosins.' +
                        '</div>';
                    $('.woocommerce-notices-wrapper').prepend(message);
                }
            }

            // Run on page load
            showNoShippingNotice();

            // Re-run every time Woo updates checkout
            $(document.body).on('updated_checkout', showNoShippingNotice);

            // Explicitly re-run when user changes billing/shipping country dropdown
            $(document).on('change', '#billing_country, #shipping_country', function () {
                // give Woo 300ms to fetch new rates, then check again
                setTimeout(showNoShippingNotice, 300);
            });
        });
    </script>
    <?php
});

// Allow quantity inputs on checkout page and add inline "Qty" label
add_filter('woocommerce_checkout_cart_item_quantity', function ($quantity, $cart_item, $cart_item_key) {
    $product = $cart_item['data'];
    $max = $product->get_max_purchase_quantity();

    $input = woocommerce_quantity_input(array(
        'input_name' => "cart[{$cart_item_key}][qty]",
        'input_value' => $cart_item['quantity'],
        'min_value' => 1,
        'max_value' => $max > 0 ? $max : '', // leave blank if unlimited
        'product_name' => $product->get_name(),
    ), $product, false);

    // Wrap label + input in inline-flex so it stays in a single row
    return $input;
}, 10, 3);

add_filter('woocommerce_cart_item_name', function ($product_name, $cart_item, $cart_item_key) {
    if (!is_checkout())
        return $product_name;

    $product = $cart_item['data'];
    if (!$product)
        return $product_name;

    $thumbnail = $product->get_image('thumbnail', [
        'style' => 'width:40px;height:auto;border-radius:4px;margin-right:10px;'
    ]);

    return '<span class="br-product-title-with-thumb" style="
                display:inline-flex;
                align-items:center;
                min-height:40px;
                gap:0.5rem;
            ">'
        . $thumbnail
        . '<span class="br-product-title">' . $product_name . '</span>'
        . '</span>';
}, 10, 3);



// Update cart quantities when changed on checkout
add_action('woocommerce_checkout_update_order_review', function ($post_data) {
    parse_str($post_data, $parsed);
    if (!empty($parsed['cart']) && is_array($parsed['cart'])) {
        $cart = WC()->cart->get_cart();
        foreach ($parsed['cart'] as $cart_key => $values) {
            if (!isset($cart[$cart_key]))
                continue;
            $cart_item = $cart[$cart_key];
            $product = $cart_item['data'];

            if (!isset($values['qty']))
                continue;
            $new_qty = max(1, (int) $values['qty']);

            $max = $product->get_max_purchase_quantity();
            if ($max > 0) {
                $new_qty = min($new_qty, $max);
            }

            WC()->cart->set_quantity($cart_key, $new_qty, false);
        }
        WC()->cart->calculate_totals();
    }
});

// ✅ Shortcode-checkout quantity UI: light buttons + dark symbols, no pink focus
add_action('wp_head', function () {
    if (!is_checkout() || is_order_received_page())
        return; ?>
    <style id="br-qty-fix">
        /* Make the whole control a single light, rounded unit */
        .woocommerce .checkout .quantity {
            display: inline-flex;
            align-items: stretch;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 6px;
            overflow: hidden;
            vertical-align: middle;
        }

        /* Your +/- buttons live directly under .quantity */
        .woocommerce .checkout .quantity>.br-qty-btn,
        .woocommerce .checkout .quantity>.br-qty-btn.button,
        .woocommerce .checkout .quantity>.br-qty-btn.wp-element-button {
            all: unset;
            /* nuke Woo/Elementor button styles */
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 44px !important;
            padding: 0 !important;
            margin: 0 !important;

            background: #f8f8f8 !important;
            /* light button */
            color: #222 !important;
            /* dark symbol */
            font-size: 22px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            cursor: pointer !important;

            border: 0 !important;
            box-shadow: none !important;
        }

        /* Hover/active feedback */
        .woocommerce .checkout .quantity>.br-qty-btn:hover {
            background: #eee !important;
        }

        .woocommerce .checkout .quantity>.br-qty-btn:active {
            background: #ddd !important;
            transform: translateY(1px);
        }

        /* Kill the pink focus ring/border some themes add */
        .woocommerce .checkout .quantity>.br-qty-btn:focus,
        .woocommerce .checkout .quantity input.qty:focus {
            outline: none !important;
            box-shadow: none !important;
            border-color: #ccc !important;
        }

        /* Input (wrapped by <span class="br-qty"> in your HTML) */
        .woocommerce .checkout .quantity .br-qty .qty,
        .woocommerce .checkout .quantity input.qty {
            border: 0;
        }

        .woocommerce .checkout .quantity input.qty::-webkit-outer-spin-button,
        .woocommerce .checkout .quantity input.qty::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
    </style>
<?php });


add_action('wp_footer', function () {
    if (!is_checkout() || is_order_received_page())
        return; ?>
    <script>
        jQuery(function ($) {
            var debTimer;
            function debouncedRefresh() {
                clearTimeout(debTimer);
                debTimer = setTimeout(function () {
                    $('body').trigger('update_checkout');
                }, 250);
            }

            function enhanceQty() {
                $('.woocommerce-checkout-review-order-table input.qty').each(function () {
                    var $input = $(this);
                    if ($input.closest('.br-qty').length) return; // already enhanced

                    var $wrap = $('<span class="br-qty" />');
                    var $minus = $('<button type="button" class="br-qty-btn" aria-label="Decrease quantity">−</button>');
                    var $plus = $('<button type="button" class="br-qty-btn" aria-label="Increase quantity">+</button>');

                    $input.after($plus).before($minus).wrap($wrap);

                    $minus.on('click', function () {
                        var min = parseInt($input.attr('min'), 10) || 1;
                        var step = parseInt($input.attr('step'), 10) || 1;
                        var cur = parseInt($input.val(), 10) || min;
                        if (cur > min) { $input.val(cur - step).trigger('input').trigger('change'); debouncedRefresh(); }
                    });

                    $plus.on('click', function () {
                        var min = parseInt($input.attr('min'), 10) || 1;
                        var max = parseInt($input.attr('max'), 10) || 9999;
                        var step = parseInt($input.attr('step'), 10) || 1;
                        var cur = parseInt($input.val(), 10) || min;
                        if (cur < max) { $input.val(cur + step).trigger('input').trigger('change'); debouncedRefresh(); }
                    });

                    $input.on('input', function () {
                        var raw = $input.val();

                        // Allow empty while typing
                        if (raw === '') {
                            clearTimeout(debTimer); // don't refresh yet
                            return;
                        }

                        // If not empty, sanitize value
                        var min = parseInt($input.attr('min'), 10) || 0;
                        var max = parseInt($input.attr('max'), 10) || 9999;
                        var val = parseInt(raw, 10);

                        if (!isNaN(val)) {
                            val = Math.max(min, Math.min(max, val));
                            $input.val(val);
                        }

                        debouncedRefresh();
                    }).on('blur', function () {
                        // If user leaves it blank and blurs, reset to min and refresh
                        if ($input.val() === '') {
                            var min = parseInt($input.attr('min'), 10) || 1;
                            $input.val(min);
                            debouncedRefresh();
                        }
                    }).on('change', debouncedRefresh);
                });
            }

            enhanceQty();
            $(document.body).on('updated_checkout', enhanceQty);
        });
    </script>
<?php });


// Remove icons from free-shipping notice and Wise payment notice
add_action('wp_head', function () {
    if (is_checkout() || is_order_received_page()): ?>
        <style>
            /* Free shipping notice */
            .woocommerce-info.br-free-shipping {
                background: #f5faff !important;
                border: 1px solid #b3d7ff !important;
                padding: 0.75em 1em;
                border-radius: 4px;
                box-shadow: none;
                background-image: none !important;
            }

            .woocommerce-info.br-free-shipping::before {
                content: none !important;
            }

            /* Wise payment notice */
            .woocommerce-info.br-wise-notice {
                background-image: none !important;
            }

            .woocommerce-info.br-wise-notice::before {
                content: none !important;
            }
        </style>
    <?php endif;
});

// CURRENCY MAPPING HELPER
function br_get_country_currency_mapping()
{
    // Countries that should use EUR
    $eu_countries = [
        'AT',
        'BE',
        'BG',
        'HR',
        'CY',
        'CZ',
        'DK',
        'EE',
        'FI',
        'FR',
        'DE',
        'GR',
        'HU',
        'IE',
        'IT',
        'LV',
        'LT',
        'LU',
        'MT',
        'NL',
        'PL',
        'PT',
        'RO',
        'SK',
        'SI',
        'ES'
    ];

    // Currency map for non-EU countries you support
    $currency_map = [
        'AU' => 'AUD',
        'CA' => 'CAD',
        'HK' => 'HKD',
        'IS' => 'ISK',
        'JP' => 'JPY',
        'NO' => 'NOK',
        'NZ' => 'NZD',
        'TW' => 'TWD',
        'SE' => 'SEK',
        'KR' => 'KRW',
        'GB' => 'GBP',
        'UA' => 'UAH',
        'CH' => 'CHF',
        // any other non-EU shipping countries you add go here
        'DEFAULT' => 'USD',
    ];

    return [
        'eu_countries' => $eu_countries,
        'currencies' => $currency_map,
    ];
}
//Currency Mapping JS
add_action('wp_enqueue_scripts', function () {
    if (!is_front_page())
        return;

    $config = br_get_country_currency_mapping();
    $shipping_countries = WC()->countries->get_shipping_countries();
    $mapping = [];

    foreach ($shipping_countries as $code => $name) {
        if (in_array($code, $config['eu_countries'], true)) {
            $currency = 'EUR';
        } else {
            $currency = $config['currencies'][$code] ?? $config['currencies']['DEFAULT'];
        }

        $mapping[strtolower($code)] = [
            'country' => $code,
            'currency' => $currency,
        ];
    }

    wp_add_inline_script(
        'jquery',
        'window.brCountryMapping = ' . wp_json_encode($mapping) . ';',
        'before'
    );
});
// AJAX: set customer country before checkout
add_action('wp_ajax_set_country_currency', 'br_set_country_only_ajax');
add_action('wp_ajax_nopriv_set_country_currency', 'br_set_country_only_ajax');
function br_set_country_only_ajax()
{
    if (!function_exists('WC') || !WC()->session) {
        wp_send_json_error(['error' => 'no_session'], 400);
    }

    $country = isset($_POST['country']) ? strtoupper(wc_clean(wp_unslash($_POST['country']))) : '';
    if (!preg_match('/^[A-Z]{2}$/', $country)) {
        wp_send_json_error(['error' => 'bad_country'], 400);
    }

    $keep = WC()->session->get('br_cached_fields') ?: [];
    $keep['billing_country'] = $country;
    $keep['shipping_country'] = $country;
    $keep['ship_to_different_address'] = '0';

    WC()->session->set('br_cached_fields', $keep);

    if (WC()->customer) {
        WC()->customer->set_billing_country($country);
        WC()->customer->set_shipping_country($country);
        WC()->customer->save();
    }

    if (WC()->cart) {
        WC()->cart->calculate_totals();
    }

    // ✅ Set express-pay flag based on country (US only; add 'CA' if you want)
    $allow = in_array($country, ['US', 'CA'], true);
    WC()->session->set('br_allow_express', $allow ? 'yes' : 'no');

    WC()->session->save_data();

    wp_send_json_success(['country' => $country, 'allow_express' => $allow ? 'yes' : 'no']);
}

// Catch ?br_country=XX on checkout and pin it to the Woo customer + our session cache
add_action('template_redirect', function () {
    if (!is_checkout() || empty($_GET['br_country']) || !function_exists('WC') || !WC()->session) {
        return;
    }

    $country = strtoupper(wc_clean(wp_unslash($_GET['br_country'])));
    if (!preg_match('/^[A-Z]{2}$/', $country)) {
        return;
    }

    // Update Woo customer object
    if (WC()->customer) {
        WC()->customer->set_billing_country($country);
        WC()->customer->set_shipping_country($country); // comment out if you want billing-only
        WC()->customer->save();
    }

    // Update our cached defaults so checkout fields prefill
    $keep = WC()->session->get('br_cached_fields') ?: [];
    $keep['billing_country'] = $country;
    $keep['shipping_country'] = $country;
    $keep['ship_to_different_address'] = '0';
    WC()->session->set('br_cached_fields', $keep);

    // ✅ Set express flag based on this country (US/CA only)
    $allow_express = in_array($country, ['US', 'CA'], true);
    WC()->session->set('br_allow_express', $allow_express ? 'yes' : 'no');

    if (WC()->cart) {
        WC()->cart->calculate_totals();
    }

    // Flush session to storage before we render the page
    WC()->session->save_data();

    // Clean URL to avoid loops
    wp_safe_redirect(remove_query_arg('br_country'));
    exit;
}, 1);


// Add to cart button css
add_action('wp_head', function () {
    ?>
    <style>
        /* Hover: subtle move down (like pressing) */
        #homepage_cart_button:hover:not(:disabled) {
            transform: translateY(2px);
            transition: transform 0.1s ease;
        }

        /* Click/active: shrink slightly */
        #homepage_cart_button:active:not(:disabled) {
            transform: scale(0.98);
            transition: transform 0.05s ease;
        }
    </style>
    <?php
});
add_action('wp_footer', function () {
    if (!is_checkout())
        return; ?>
    <script>
        jQuery(function ($) {
            var $wrapper = $('.wcpay-express-checkout-wrapper, .wcpay-payment-request-wrapper');

            // ✅ Maintain a list of countries where express checkout should be allowed
            var allowedCountries = ['US', 'CA', 'AU', 'NZ', 'HK', 'KR'];

            function toggleExpressButtons() {
                var country = ($('#billing_country').val() || '').toUpperCase();

                if (allowedCountries.includes(country)) {
                    $wrapper.css('visibility', 'visible').hide().fadeIn(150);
                } else {
                    $wrapper.css('visibility', 'hidden');
                }
            }

            // Hide (visually) on load but keep space reserved
            $wrapper.css('visibility', 'hidden');

            // Initial run
            toggleExpressButtons();

            // Run after Woo finishes updating totals
            $(document.body).on('updated_checkout', toggleExpressButtons);

            // Re-check on billing country change
            $(document).on('change', '#billing_country', function () {
                $wrapper.css('visibility', 'hidden'); // keep hidden during refresh
            });
        });
    </script>
    <?php
});

add_action('wp_footer', function () {
    if (!is_checkout())
        return;

    // Build map of code => symbol from WooCommerce
    $all_currencies = get_woocommerce_currencies();
    $symbols = [];
    foreach ($all_currencies as $code => $name) {
        $symbols[$code] = html_entity_decode(get_woocommerce_currency_symbol($code));
    }
    ?>
    <script>
        jQuery(function ($) {
            var currencySymbols = <?php echo wp_json_encode($symbols); ?>;

            function fixCurrencySelect() {
                var $sel = $('.br-currency-switcher select, .wcpay-currency-switcher select, select[name="wcpay-currency"]').first();
                if (!$sel.length) return;

                var current = $sel.val();
                var opts = $sel.find('option').get();

                opts.forEach(function (opt) {
                    var $o = $(opt);
                    var code = ($o.val() || '').toUpperCase();
                    if (!code) return;

                    // Extract leading country flag (if present)
                    var txt = ($o.text() || '').trim();
                    var flagMatch = txt.match(/^\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/);
                    var flag = flagMatch ? flagMatch[0] : '';

                    // Get symbol from PHP map, default to empty if unknown
                    var symbol = currencySymbols[code] || '';

                    // Build clean label: flag + CODE + symbol
                    var newLabel = [flag, code, symbol].filter(Boolean).join(' ');
                    $o.text(newLabel);
                });

                // Sort alphabetically by code
                opts.sort(function (a, b) {
                    return (a.value || '').localeCompare(b.value || '');
                });

                $sel.empty().append(opts);
                if (current) $sel.val(current);
            }

            fixCurrencySelect();
            $(document.body).on('updated_checkout', fixCurrencySelect);
        });
    </script>
    <?php
});

// Require EUR for SEPA
add_action('wp_footer', function () {
    if (!is_checkout())
        return; ?>
    <script>
        jQuery(function ($) {
            $('form.checkout').on('checkout_place_order', function (e) {
                var currency = '<?php echo esc_js(get_woocommerce_currency()); ?>';
                var payMethod = $('input[name="payment_method"]:checked').val();

                // 🚫 Block SEPA unless EUR is selected
                if (payMethod === 'bacs' && currency !== 'EUR') {
                    alert('⚠️ To pay by SEPA Transfer, please change your currency to EUR using the selector at the top of the page.');
                    e.preventDefault();
                    return false;
                }
            });
        });
    </script>
<?php });

/* ============================
 * ICELAND (IS) SPECIAL HANDLING
 * - Show VAT line (24%) + Pósturinn note
 * - Charge NET (gross ÷ 1.24)
 * - Persist amount on order + show in emails/admin
 * ============================ */

/**
 * Helper: are we shipping to Iceland (or billing if "ship to different" not checked)?
 */
function br_is_iceland_checkout_destination(): bool
{
    if (!function_exists('WC') || !WC()->customer)
        return false;

    // Figure out whether shipping address is in use
    $use_ship = false;
    if (isset($_POST['ship_to_different_address'])) {
        $use_ship = wc_string_to_bool(wp_unslash($_POST['ship_to_different_address']));
    } elseif (WC()->checkout) {
        $use_ship = wc_string_to_bool((string) WC()->checkout->get_value('ship_to_different_address'));
    }

    // Pull country code respecting the above
    if ($use_ship) {
        $country = isset($_POST['shipping_country'])
            ? strtoupper(wc_clean(wp_unslash($_POST['shipping_country'])))
            : strtoupper((string) WC()->customer->get_shipping_country());
    } else {
        $country = isset($_POST['billing_country'])
            ? strtoupper(wc_clean(wp_unslash($_POST['billing_country'])))
            : strtoupper((string) WC()->customer->get_billing_country());
    }

    return $country === 'IS';
}

/**
 * Compute the 24% "remove-on-export" amount from the current cart grand total
 * (items + shipping + fees – discounts). We apply a NET-out: net = gross / 1.24
 * and therefore "vat_portion" = gross - net.
 */
function br_iceland_calc_vat_portion_for_cart(WC_Cart $cart): float
{
    // Use cart totals pieces (ex taxes). For IS we don't actually charge any tax,
    // and we want to net the *displayed* grand figure, including shipping.
    $gross_like_total = (float) $cart->get_cart_contents_total()
        + (float) $cart->get_shipping_total()
        + (float) $cart->get_fee_total()
        - (float) $cart->get_discount_total();

    if ($gross_like_total <= 0)
        return 0.0;

    $net = $gross_like_total / 1.24;
    $vat_part = $gross_like_total - $net;

    // Guard against tiny negatives from FP math
    return $vat_part > 0 ? $vat_part : 0.0;
}

/**
 * On checkout, reduce the amount to be charged so it equals TOTAL ÷ 1.24.
 * We do this via a negative fee in the cart so the customer sees/gets charged the net.
 * (We also clean this up on the order to avoid duplicate fee lines.)
 */
add_action('woocommerce_cart_calculate_fees', function ($cart) {
    if (is_admin() && !wp_doing_ajax())
        return;
    if (!is_checkout())
        return;
    if (!$cart instanceof WC_Cart)
        return;

    if (!br_is_iceland_checkout_destination()) {
        if (WC()->session)
            WC()->session->set('br_iceland_vat_amount', 0);
        return;
    }

    $vat_part = br_iceland_calc_vat_portion_for_cart($cart);
    if ($vat_part <= 0) {
        if (WC()->session)
            WC()->session->set('br_iceland_vat_amount', 0);
        return;
    }

    // Store for display on the live checkout table
    if (WC()->session) {
        WC()->session->set('br_iceland_vat_amount', $vat_part);
    }

    // Apply a negative fee so the charged total is net-of-24%
    $cart->add_fee(__('Iceland VSK (24%) removed', 'br'), -1 * $vat_part, false);
}, 99);

/**
 * Checkout table row: show the VAT amount + Pósturinn explanatory text with link.
 */
add_action('woocommerce_review_order_after_order_total', function ($order_id = null) {
    // Live checkout (cart context)
    if (!$order_id && !is_order_received_page()) {
        if (!br_is_iceland_checkout_destination())
            return;

        $vat = 0.0;
        if (WC()->session) {
            $vat = (float) (WC()->session->get('br_iceland_vat_amount') ?: 0);
        }
        if ($vat <= 0)
            return;

        $link = esc_url('https://posturinn.is/en/individuals/information/automatic-payments/');
        echo '<tr class="br-iceland-vat">
                <th style="text-align:left;">24% VSK (payable to Posturinn)</th>
                <td><strong>' . wc_price($vat) . '</strong>
                    <div style="font-size:12px;color:#555;margin-top:2px;">
                        Posturinn will collect 24% VSK on delivery plus 799 kr shipping fee and 600 kr customs fee if
                        <a href="' . $link . '" target="_blank" rel="noopener">automatic payment is enabled</a>.
                    </div>
                </td>
              </tr>';
    }
});

/**
 * Make the order itself clean and truly NET-of-24% (divide all lines by 1.24),
 * remove our cart fee line, and persist the VAT amount on the order for emails/admin.
 */
add_action('woocommerce_checkout_order_created', function ($order) {
    if (!$order instanceof WC_Order)
        return;

    // Determine destination on the order object (shipping preferred)
    $dest = strtoupper($order->get_shipping_country() ?: $order->get_billing_country());
    if ($dest !== 'IS')
        return;

    // Prevent double application if admin re-saves
    if ($order->get_meta('_br_iceland_net_applied') === 'yes')
        return;

    $before_total = (float) $order->get_total();

    // 1) Transform all product lines to NET by dividing by 1.24
    foreach ($order->get_items('line_item') as $item) {
        $sub = (float) $item->get_subtotal();
        $tot = (float) $item->get_total();
        if ($sub > 0)
            $item->set_subtotal($sub / 1.24);
        if ($tot > 0)
            $item->set_total($tot / 1.24);
        $item->set_subtotal_tax(0);
        $item->set_total_tax(0);
        $item->save();
    }

    // 2) Transform shipping lines to NET by dividing by 1.24 (if any)
    foreach ($order->get_items('shipping') as $ship) {
        $ship_total = (float) $ship->get_total();
        if ($ship_total > 0) {
            $ship->set_total($ship_total / 1.24);
        }
        $ship->set_taxes([]);
        $ship->save();
    }

    // 3) Remove our "cart fee" line if present (to avoid duplication on the order)
    foreach ($order->get_items('fee') as $fee_id => $fee_item) {
        if (stripos($fee_item->get_name(), 'Iceland VSK (24%) removed') !== false) {
            // Set to zero rather than deleting to be extra safe with totals
            $fee_item->set_total(0);
            $fee_item->save();
        }
    }

    // 4) Mark order as prices-excluding-tax & recalc cleanly
    if (method_exists($order, 'set_prices_include_tax')) {
        $order->set_prices_include_tax(false);
    }
    $order->update_meta_data('_prices_include_tax', 'no');

    $order->calculate_totals(true);

    $after_total = (float) $order->get_total();
    $iceland_vat_amount = max(0, $before_total - $after_total);
    $order->update_meta_data('_br_iceland_vat_amount', $iceland_vat_amount);
    $order->update_meta_data('_br_iceland_net_applied', 'yes');
    $order->save();
}, 30);

/**
 * Add the Iceland VAT row (with explanatory text/link) to emails/admin totals block.
 */
add_filter('woocommerce_get_order_item_totals', function ($totals, $order, $tax_display) {
    if (!$order instanceof WC_Order)
        return $totals;
    $dest = strtoupper($order->get_shipping_country() ?: $order->get_billing_country());
    if ($dest !== 'IS')
        return $totals;

    $vat = (float) $order->get_meta('_br_iceland_vat_amount');
    if ($vat <= 0)
        return $totals;

    $link = esc_url('https://posturinn.is/en/individuals/information/automatic-payments/');
    $row = [
        'label' => __('24% VAT (payable to Pósturinn)', 'br'),
        'value' => wc_price($vat, ['currency' => $order->get_currency()])
            . '<br><small style="color:#555;">Posturinn will collect 24% VSK on delivery plus 799 kr shipping fee and 600 kr customs fee if <a href="' . $link . '" target="_blank" rel="noopener">automatic payment is enabled</a>.</small>',
    ];

    // Insert just before the final order_total line if present
    $new = [];
    $inserted = false;
    foreach ($totals as $key => $data) {
        if ($key === 'order_total' && !$inserted) {
            $new['br_iceland_vat'] = $row;
            $inserted = true;
        }
        $new[$key] = $data;
    }
    if (!$inserted) {
        $new['br_iceland_vat'] = $row;
    }
    return $new;
}, 20, 3);

/**
 * Small style tweak so the Iceland row matches your Norway row sizing.
 */
add_action('wp_head', function () {
    if (!is_checkout() && !is_order_received_page())
        return; ?>
    <style>
        .br-iceland-vat th,
        .br-iceland-vat td {
            font-size: 1em;
            color: #555;
        }
    </style>
<?php });
/* ============================
 * ICELAND ONLY: change "Total" label
 * - Checkout: "Total (Pay Now)"
 * - Thank-you & emails: "Total (Paid Now)"
 * ============================ */

/** Thank-you page + emails */
add_filter('woocommerce_get_order_item_totals', function ($totals, $order, $tax_display) {
    if (!$order instanceof WC_Order)
        return $totals;
    $dest = strtoupper($order->get_shipping_country() ?: $order->get_billing_country());
    if ($dest !== 'IS')
        return $totals;

    if (isset($totals['order_total'])) {
        // Receipt + emails both say "(Paid Now)"
        $totals['order_total']['label'] = __('Total (Paid Now)', 'br');
    }
    return $totals;
}, 30, 3);

/** Checkout page (shortcode checkout) — change the label via JS */
add_action('wp_footer', function () {
    if (!is_checkout() || is_order_received_page())
        return; ?>
    <script>
        jQuery(function ($) {
            function isIS() {
                var useShip = $('#ship-to-different-address-checkbox').is(':checked');
                var c = (useShip ? $('#shipping_country').val() : $('#billing_country').val()) || '';
                return (c.toUpperCase() === 'IS');
            }
            function relabel() {
                var $th = $('.woocommerce-checkout-review-order-table tr.order-total th');
                if (!$th.length) return;

                if (isIS()) {
                    if ($th.find('.br-pay-now-suffix').length === 0) {
                        $th.html('Total <span class="br-pay-now-suffix">(Pay Now)</span>');
                    }
                } else {
                    // Restore to plain "Total" if we previously changed it
                    if ($th.find('.br-pay-now-suffix').length) {
                        $th.text('Total');
                    }
                }
            }
            relabel();
            $(document.body).on('updated_checkout', relabel);
            $(document).on('change', '#billing_country, #shipping_country, #ship-to-different-address-checkbox', function () {
                setTimeout(relabel, 60);
            });
        });
    </script>
<?php });

/**
 * Rename BACS gateway label + description when shipping to Germany.
 */
add_filter('woocommerce_gateway_title', function ($title, $gateway_id) {
    if ($gateway_id !== 'bacs')
        return $title;

    if (!function_exists('WC') || !WC()->customer) {
        return $title; // ✅ bail early if no customer object
    }

    $use_ship = false;
    if (isset($_POST['ship_to_different_address'])) {
        $use_ship = wc_string_to_bool(wp_unslash($_POST['ship_to_different_address']));
    } elseif (WC()->checkout) {
        $use_ship = wc_string_to_bool((string) WC()->checkout->get_value('ship_to_different_address'));
    }

    $country = $use_ship ? WC()->customer->get_shipping_country() : WC()->customer->get_billing_country();
    if (strtoupper($country) === 'DE') {
        $title = 'SEPA Überweisung';
    }

    return $title;
}, 10, 2);

add_filter('woocommerce_gateway_description', function ($description, $gateway_id) {
    if ($gateway_id !== 'bacs')
        return $description;

    if (!function_exists('WC') || !WC()->customer) {
        return $description; // ✅ bail early if no customer object
    }

    $use_ship = false;
    if (isset($_POST['ship_to_different_address'])) {
        $use_ship = wc_string_to_bool(wp_unslash($_POST['ship_to_different_address']));
    } elseif (WC()->checkout) {
        $use_ship = wc_string_to_bool((string) WC()->checkout->get_value('ship_to_different_address'));
    }

    $country = $use_ship ? WC()->customer->get_shipping_country() : WC()->customer->get_billing_country();
    if (strtoupper($country) === 'DE') {
        $description = '<p>Pay conveniently from your EU bank account. After placing your order, you will receive an email with the transfer details, and your order will be shipped as soon as the payment is received.<br>Bezahlen Sie bequem von Ihrem EU-Bankkonto. Sie erhalten nach der Bestellung eine E-Mail mit den Überweisungsdaten, und Ihre Bestellung wird versendet, sobald die Zahlung eingegangen ist.</p>';
    }

    return $description;
}, 10, 2);

/**
 * JS: Update both label + description dynamically when country changes.
 */
add_action('wp_footer', function () {
    if (!is_checkout())
        return; ?>
    <script>
        jQuery(function ($) {
            function updateBacsUI() {
                var useShip = $('#ship-to-different-address-checkbox').is(':checked');
                var country = (useShip ? $('#shipping_country').val() : $('#billing_country').val()) || '';
                var $label = $('label[for="payment_method_bacs"]');
                var $desc = $('.payment_method_bacs .payment_box p');

                if (!$label.length) return;

                if (country.toUpperCase() === 'DE') {
                    // Change label + description to German
                    $label.contents().filter(function () { return this.nodeType === 3; }).first().replaceWith('SEPA Überweisung Transfer');
                    if ($desc.length) {
                        $desc.html('<p>Bezahlen Sie bequem von Ihrem EU-Bankkonto. Sie erhalten nach der Bestellung eine E-Mail mit den Überweisungsdaten, und Ihre Bestellung wird versendet, sobald die Zahlung eingegangen ist.</p><p>Pay conveniently from your EU bank account. After placing your order, you will receive an email with the transfer details, and your order will be shipped as soon as the payment is received.</p>');
                    }
                } else {
                    // Revert to default English
                    $label.contents().filter(function () { return this.nodeType === 3; }).first().replaceWith('SEPA Bank Transfer (EUR only)');
                    if ($desc.length) {
                        $desc.text('Pay easily from your EU bank account. You’ll get an email with transfer details after checkout, and your order will ship once payment is received.');
                    }
                }
            }

            updateBacsUI();
            $(document.body).on('updated_checkout', updateBacsUI);
            $(document).on('change', '#billing_country, #shipping_country, #ship-to-different-address-checkbox', function () {
                setTimeout(updateBacsUI, 80);
            });
        });
    </script>
<?php });

/**
 * Centralized "Import Fees" notice renderer
 * - Shows in checkout (below Total) and on Thank-You page
 * - Handles Taiwan (1 vs 2+), EU (VAT prepaid), German translation (label + content)
 */
// Checkout page (inside totals <table>)
add_action('woocommerce_review_order_after_order_total', 'br_show_import_notice');
// Order details + Thank-You + My Account (inject as a totals row)
add_filter('woocommerce_get_order_item_totals', 'br_add_import_notice_total', 20, 3);
function br_add_import_notice_total($totals, $order, $tax_display)
{
    // Capture the output of your existing renderer as HTML
    ob_start();
    br_show_import_notice($order); // echoes a <tr> normally, but we only need its inner cells
    $tr = trim(ob_get_clean());
    if (!$tr)
        return $totals;

    // Extract label and value from the <tr> your function prints
    if (preg_match('#<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>#is', $tr, $m)) {
        $label = wp_kses_post($m[1]);
        $value = $m[2]; // allow HTML

        // Insert right after the order total
        $out = [];
        foreach ($totals as $key => $row) {
            $out[$key] = $row;
            if ('order_total' === $key) {
                $out['br_import_notice'] = [
                    'label' => $label,
                    'value' => $value,
                ];
            }
        }
        return $out;
    }

    return $totals;
}

function br_show_import_notice($order_or_id = null)
{
    // 1) Determine destination + quantity
    $country = '';
    $cart_count = 0;
    $order = null;

    // Accept WC_Order object or order ID
    if ($order_or_id instanceof WC_Order) {
        $order = $order_or_id;
    } elseif ($order_or_id) {
        $order = wc_get_order($order_or_id);
    }

    if ($order) {
        $country = strtoupper($order->get_shipping_country() ?: $order->get_billing_country());
        $cart_count = $order->get_item_count();
    } else {
        $customer = (function_exists('WC') && WC()->customer) ? WC()->customer : null;
        $country = $customer ? strtoupper($customer->get_shipping_country() ?: $customer->get_billing_country()) : '';
        $cart_count = (function_exists('WC') && WC()->cart) ? WC()->cart->get_cart_contents_count() : 0;
    }

    if (!$country)
        return;

    // 2) Country configuration
    $import_messages = [

        // 🇹🇼 Taiwan
        'TW' => [
            'label' => [
                'tw' => '進口稅費',
                'en' => 'Import Fees',
            ],
            'under' => '<div style="font-weight:normal;color:#555;margin-top:2px;line-height:1.4;">
							免關稅與營業稅，免額外費用送達。
							<div style="font-size:0.9em;color:#555;margin-top:2px;line-height:1.4;">No duty or VAT, delivered with no extra fees.</div>
						</div>',
            'over' => '<div style="font-weight:normal;font-size:0.8rem;color:#555;margin-top:2px;line-height:1.4;">
							訂單金額超過 NT$2,000 可能需繳 3.5% 關稅與 5% 增值稅，由中華郵政於送達時代收。<br>
							若被收取任何稅費，請保留收據並寄給我，我會全額退還，無論金額多少。<br>
							<span style="color:#555;">Orders over NT$2,000 may be charged 3.5% duty and 5% VAT by Taiwan Customs, collected by Chunghwa Post at delivery.
							If any fees are charged, keep the receipt and email it to me — I’ll refund the full amount, whatever it is.</span>
						</div>',
            'threshold' => 1
        ],
        // 🇨🇭 Switzerland
        'CH' => [
            'label' => [
                'en' => 'Import Fees', // English only
            ],
            // 1 rosin → under VAT threshold → no fees
            'under' => '<div style="font-weight:normal;color:#555;margin-top:2px;line-height:1.4;">
							Clears Swiss Customs with <strong>no taxes or fees due at delivery</strong>.
						</div>',
            // >1 → ask to email so we can decide whether multiple parcels or one with fees
            'over' => '<div style="font-weight:normal;font-size:0.8rem;color:#555;margin-top:2px;line-height:1.4;">
						  For Switzerland, to order more than one rosin please email <strong>[br_email]</strong> and I will arrange the best shipping option for your order.
					   </div>',
            'threshold' => 1
        ],

        // 🇪🇺 EU (all IOSS countries)
        'EU' => [
            'countries' => [
                'AT',
                'BE',
                'BG',
                'HR',
                'CY',
                'CZ',
                'DK',
                'EE',
                'FI',
                'FR',
                'DE',
                'GR',
                'HU',
                'IE',
                'IT',
                'LV',
                'LT',
                'LU',
                'MT',
                'NL',
                'PL',
                'PT',
                'RO',
                'SK',
                'SI',
                'ES',
                'SE',
                'NO'
            ],
            'label' => [
                'de' => 'Importgebühren',
                'en' => 'Import Fees',
            ],
            'messages' => [
                'de' => '<strong style="color:#555">Keine zusätzlichen Gebühren bei Lieferung</strong>
						 <div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
							Ihre Bestellung wird vom Zoll freigegeben und ohne zusätzliche Kosten zugestellt.
						 </div>',
                'en' => '<strong style="color:#555">No additional fees due at delivery</strong>
						 <div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
							Your order will clear customs and arrive with no extra charges.
						 </div>',
            ]
        ],

        // 🇰🇷 Korea
        'KR' => [
            'label' => [
                'ko' => '수입비용',
                'en' => 'Import Fees',
            ],
            'messages' => [
                'ko' => '<strong style="color:#555">추가 비용 없음</strong>
						 <div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
							귀하의 주문은 세관을 통과하며 추가 요금 없이 배송됩니다.
						 </div>',
                'en' => '<strong style="color:#555">No additional fees due at delivery</strong>
						 <div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
							Your order will clear customs and arrive with no extra charges.
						 </div>',
            ]
        ],
        // 🇯🇵 Japan
        'JP' => [
            'label' => '輸入手数料 / Import Fees', // Native + English combined
            'under' => '<div style="font-weight:normal;color:#555;margin-top:2px;line-height:1.4;">
							追加の関税・税金・手数料はかかりません。<br>
							<div style="font-size:0.9em;color:#555;margin-top:2px;line-height:1.4;">No additional taxes, duty, or courier fees.</div>
						</div>',
            'over' => '<div style="font-weight:normal;font-size:0.8rem;color:#555;margin-top:2px;line-height:1.4;">
							￥10,000を超えるご注文には、消費税10％および日本郵便の取扱手数料￥200が配達時にいただきます。<br>
							<span style="color:#555;">Orders over ¥10,000 will have 10 % consumption tax + ¥200 Japan Post clearance fee collected on delivery.</span>
						</div>',
            'threshold' => 1 // ¥10,000 CIF
        ],
        // 🇶🇦 Qatar
        'QA' => [
            'label' => 'رسوم الاستيراد / Import Fees', // Native + English combined
            'messages' => [
                'ar' => '<div dir="rtl" lang="ar" style="font-family: sans-serif;">
							<strong style="color:#555">لا توجد رسوم إضافية عند التوصيل</strong>
							<div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
								سيصل طلبك بعد التخليص الجمركي دون أي تكاليف إضافية.
							</div>
						 </div>',
                'en' => '<strong style="color:#555">No additional fees due at delivery</strong>
					<div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;margin-bottom:8px;">
						Your order will clear customs and arrive with no extra charges.
					</div>',
            ]
        ],
        // 🇩🇿 Algeria
        'DZ' => [
            'label' => 'Import Fees',
            'messages' => '<strong style="color:#555">Algérie Poste will likely not charge 19% VAT.</strong>	
							</div>'
        ],
        // 🇲🇽 México
        'MX' => [
            'label' => 'Gastos de importación / Import Fees', // Native + English combined

            // 1 item
            'under' => '<div style="font-weight:normal;color:#555;margin-top:2px;line-height:1.4;">
							Sin impuestos ni cargos extras.<br>
							<span style="color:#555;font-size:0.9em;">No taxes or extra fees.</span>
						</div>',

            // 2+ items
            'over' => '<div style="font-weight:normal;font-size:0.8rem;color:#555;margin-top:2px;line-height:1.4;">
							Impuestos y aranceles ya incluidos. No se cobrará nada adicional en la entrega.<br>
							<span style="color:#555;">Taxes & duty included. Nothing due at delivery.</span>
						</div>',

            'threshold' => 1 // quantity threshold
        ],

        // 🇬🇧 Great Britain (post-Brexit)
        'GB' => [
            'label' => 'Import Fees',
            'messages' => '<strong style="color:#555">No additional fees due at delivery</strong>
							<div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
								Your order will clear customs and arrive with no extra charges.
							</div>'
        ],
        // 🇨🇦 Canada
        'CA' => [
            'label' => 'Import Fees',
            'messages' => '<strong style="color:#555">No additional fees due at delivery</strong>
							<div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
								Your order will clear customs and arrive with no extra charges.
							</div>'
        ],
        // 🇭🇰 Hong Kong
        'HK' => [
            'label' => '進口稅費 / Import Fees',
            'messages' => '<strong style="color:#555">送貨時無需額外稅項或費用</strong>
							 <div style="font-size:12px;color:#555;margin-top:2px;line-height:1.4;">
								免關稅與消費稅，免額外費用送達。<br>
								<span style="color:#555;font-size:0.9em;">No duty or consumption tax, delivered with no extra fees.</span>
							 </div>'
        ]
    ];

    // Prepare output variables
    $label = '';
    $msg = '';
    $css_class = 'br-import-notice';

    // 3) Handle country-specific messages
    switch ($country) {
        case 'TW': // Taiwan
            $css_class .= ' br-taiwan';
            $label = $import_messages['TW']['label']['tw'] . ' / ' . $import_messages['TW']['label']['en'];
            $msg = ($cart_count <= $import_messages['TW']['threshold'])
                ? $import_messages['TW']['under']
                : $import_messages['TW']['over'];
            break;

        case 'CH': // Switzerland
            $css_class .= ' br-switzerland';
            $label = $import_messages['CH']['label']['en']; // English only
            $msg = ($cart_count <= $import_messages['CH']['threshold'])
                ? $import_messages['CH']['under']
                : $import_messages['CH']['over'];
            break;

        case 'KR': // Korea
            $css_class .= ' br-korea';
            $label = $import_messages['KR']['label']['ko'] . ' / ' . $import_messages['KR']['label']['en'];
            $msg = $import_messages['KR']['messages']['ko'] . $import_messages['KR']['messages']['en'];
            break;

        case 'JP': // Japan
            $css_class .= ' br-japan';
            $label = $import_messages['JP']['label'];
            $msg = ($cart_count <= $import_messages['JP']['threshold'])
                ? $import_messages['JP']['under']
                : $import_messages['JP']['over'];
            break;

        case 'QA': // Qatar
            $css_class .= ' br-qatar';
            $label = $import_messages['QA']['label'];
            // Note: The message structure already had the Arabic (native) first and English second, separated by a line.
            $msg = $import_messages['QA']['messages']['ar'] .
                '<div style="border-top:1px solid #eee; margin: 4px 0;"></div>' .
                $import_messages['QA']['messages']['en'];
            break;

        case 'DZ': // Algeria
            $css_class .= ' br-algeria';
            $label = $import_messages['DZ']['label'];
            $msg = $import_messages['DZ']['messages'];
            break;

        case 'MX': // Mexico
            $css_class .= ' br-mexico';
            $label = $import_messages['MX']['label'];
            $msg = ($cart_count <= $import_messages['MX']['threshold'])
                ? $import_messages['MX']['under']
                : $import_messages['MX']['over'];
            break;

        case 'GB': // Great Britain
            $css_class .= ' br-gb';
            $label = $import_messages['GB']['label'];
            $msg = $import_messages['GB']['messages'];
            break;

        case 'CA': // Canada
            $css_class .= ' br-ca';
            $label = $import_messages['CA']['label'];
            $msg = $import_messages['CA']['messages'];
            break;

        case 'HK': // Hong Kong
            $css_class .= ' br-hk';
            $label = $import_messages['HK']['label'];
            $msg = $import_messages['HK']['messages'];
            break;

        default:
            // 4) EU case: English default. German/English only for DE/AT.
            if (in_array($country, $import_messages['EU']['countries'], true)) {
                $css_class .= ' br-eu';

                if (in_array($country, ['DE', 'AT'], true)) {
                    // German/English for Germany and Austria
                    $label = $import_messages['EU']['label']['de'] . ' / ' . $import_messages['EU']['label']['en'];
                    $msg = $import_messages['EU']['messages']['de'] .
                        '<div style="border-top:1px solid #eee; margin: 4px 0;"></div>' .
                        $import_messages['EU']['messages']['en'];
                } else {
                    // English only for all other EU countries
                    $label = $import_messages['EU']['label']['en'];
                    $msg = $import_messages['EU']['messages']['en'];
                }
            }
            break;
    }

    // 5) Output the notice if a label and message were set
    if ($label && $msg) {
        echo '<tr class="' . esc_attr($css_class) . '"><th style="font-weight:normal;text-align:left;">' .
            esc_html($label) .
            '</th><td>' . $msg . '</td></tr>';
    }
}
add_action('wp_footer', function () {
    if (!is_checkout())
        return; ?>
    <script>
        jQuery(function ($) {
            function upsertUpsell() {
                $('.br-free-shipping-wrapper').remove();

                var qty = 0;
                $('.woocommerce .qty').each(function () {
                    qty += parseInt($(this).val(), 10) || 0;
                });

                var useShipAddress = $('#ship-to-different-address-checkbox').is(':checked');
                var country = useShipAddress
                    ? ($('#shipping_country').val() || '').toUpperCase()
                    : ($('#billing_country').val() || '').toUpperCase();

                // Skip for countries with free shipping on all orders
                if (qty !== 1 || ['US', 'CA', 'AU', 'NZ', 'JP', 'KR', 'TW', 'HK', 'QA', 'DZ'].includes(country)) return;

                // Choose message per country
                var messageText;
                switch (country) {
                    case 'DE': // Germany
                    case 'AT': // Austria (German)
                        messageText = '💡 <b>Gratisversand sichern</b>: Fügen Sie ein weiteres Kolophonium hinzu.';
                        break;
                    case 'FR':
                        messageText = '💡 <b>Livraison gratuite</b> : Ajoutez une deuxième colophane pour bénéficier de la livraison gratuite.';
                        break;
                    case 'ES':
                        messageText = '💡 <b>Envío gratis</b>: Añade otra resina para obtener el envío gratuito.';
                        break;
                    /*case 'KR': // South Korea — now has free shipping on all orders
                        messageText = '💡 <b>무료 배송 받기</b>: 장바구니에 로진을 하나 더 추가하세요.';
                        break;
                    case 'TW': // Taiwan — now has free shipping on all orders
                        messageText = '💡 <b>解鎖免運優惠</b>：再加購一塊松香即可享有免運。';
                        break;*/
                    case 'CN':
                        messageText = '💡 <b>解锁免运优惠</b>：再加购一块松香即可享有免运。';
                        break;
                    /*case 'HK':
                        messageText = '💡 <b>解鎖免運優惠</b>：再加購一塊松香即可享有免運。';
                        break;
                    case 'US': // United States — free shipping on all orders
                    case 'CA': // Canada — free shipping on all orders
                    case 'AU': // Australia — free shipping on all orders
                    case 'NZ': // New Zealand — free shipping on all orders
                    case 'JP': // Japan — free shipping on all orders
                        // intentionally skipped
                        break;*/
                    default: // fallback English
                        messageText = '💡 <b>Unlock Free Shipping</b>: Add one more rosin to your cart to qualify.';
                }

                var message = '<div class="br-free-shipping-wrapper">' +
                    '<div class="woocommerce-info br-free-shipping" style="margin-top:1em; padding:0.75em; background:#f5faff; border:1px solid #b3d7ff; border-radius:4px;">' +
                    messageText +
                    '</div></div>';

                $('.woocommerce-checkout-review-order-table').before(message);
            }

            // Clear + re-run after each checkout update
            $(document.body).on('update_checkout', function () {
                $('.br-free-shipping-wrapper').remove();
            });
            $(document.body).on('updated_checkout', upsertUpsell);
            $(document).on('change', '.woocommerce .qty, #billing_country, #shipping_country, #ship-to-different-address-checkbox', function () {
                setTimeout(upsertUpsell, 150);
            });

            upsertUpsell();
        });
    </script>
<?php });

add_action('woocommerce_checkout_after_customer_details', function () {
    if (!is_checkout() || is_order_received_page())
        return;

    // Detect visitor country (Woo session → GeoIP)
    $country = '';
    if (WC()->customer) {
        $country = strtoupper(WC()->customer->get_shipping_country() ?: WC()->customer->get_billing_country());
    }
    if (!$country && class_exists('WC_Geolocation')) {
        $geo = WC_Geolocation::geolocate_ip();
        $country = strtoupper($geo['country'] ?? '');
    }

    // Localized text map
    $texts = [
        'FR' => ['title' => 'Des difficultés pour commander ?', 'body' => 'Écrivez-moi directement et je vous aiderai à finaliser la commande.'],
        'DE' => ['title' => 'Probleme beim Bestellen?', 'body' => 'Schreiben Sie mir direkt, und ich helfe Ihnen beim Abschluss der Bestellung.'],
        'ES' => ['title' => '¿Problemas para hacer el pedido?', 'body' => 'Envíame un correo y te ayudaré a completar tu compra.'],
        'IT' => ['title' => 'Problemi con l’ordine?', 'body' => 'Scrivimi direttamente e ti aiuterò a completarlo.'],
        'JP' => ['title' => 'ご注文でお困りですか？', 'body' => 'メールで直接お問い合わせください。'],
        'KR' => ['title' => '주문에 문제가 있나요?', 'body' => '이메일로 직접 연락주시면 도와드리겠습니다.'],
        'TW' => [
            'title' => '下單遇到問題嗎？',
            'body' => '結帳沒成功嗎？
有時台灣信用卡會擋住國際交易。沒關係，請寄信給我，我會幫你處理訂購。
用中文沒問題：'
        ],
        'UA' => ['title' => 'Проблеми з оформленням замовлення?', 'body' => 'Напишіть мені безпосередньо, і я допоможу завершити покупку.'],

        'DEFAULT' => ['title' => 'Having trouble ordering?', 'body' => 'Email me directly and I’ll help you complete your order.']
    ];

    $t = $texts[$country] ?? $texts['DEFAULT'];

    echo '<div class="br-help-box" style="margin:1.5rem 0;padding:1rem;border:1px solid #ccc;border-radius:6px;background:#f9f9f9;">';
    echo '<strong style="display:block;font-size:1.1rem;margin-bottom:0.25rem;">' . esc_html($t['title']) . '</strong>';
    echo '<p style="margin:0 0 0.25rem 0;">' . esc_html($t['body']) . '</p>';
    echo do_shortcode('[bassment_email]');
    echo '</div>';
});

// === Country-specific Top Banner (currently Norway only) ===
add_action('wp_enqueue_scripts', function () {
    if (!class_exists('WC_Geolocation'))
        return;

    // Detect visitor country (server-side)
    $geo = new WC_Geolocation();
    $location = $geo->geolocate_ip();
    $country = isset($location['country']) ? strtoupper($location['country']) : 'US';

    // Country → message map
    $banners = [
        //... (your banner messages)
        'QA' => '🇶🇦 <strong>Free shipping to Qatar on all orders</strong> &nbsp;|&nbsp; شحن مجاني إلى قطر على جميع الطلبات',
        'DZ' => '🇩🇿 <strong>Free shipping to Algeria on all orders</strong>',
        'JP' => '【店頭購入・試奏も可能】京都コントラバス工房角本様にて',
    ];

    // If country not in map, stop
    if (empty($banners[$country]))
        return;

    // Inject banner content and CSS styles
    $message = $banners[$country];
    wp_add_inline_script(
        'jquery-core',
        "jQuery(function($){ 
            var \$banner = $('.free-shipping-banner');

            // 1. Inject the HTML content
            \$banner.html(" . json_encode($message) . "); 
            
            // 2. Apply CSS styles directly to the element using jQuery
            \$banner.css({
                'display': 'flex',
                'justify-content': 'center',
                'align-items': 'center',
                'text-align': 'center'
            });
        });"
    );
});

/* HIDE FREE SHIPPING TOP BANNER FOR NOW 
// Internationalize top banner
add_action( 'wp_enqueue_scripts', function() {
    if ( ! class_exists( 'WC_Geolocation' ) ) {
        return;
    }

    // Detect visitor country (server-side)
    $geo      = new WC_Geolocation();
    $location = $geo->geolocate_ip();
    $country  = isset( $location['country'] ) ? $location['country'] : 'US';

    // EU country codes
    $eu_countries = [
        'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV',
        'LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
    ];

    // English-speaking countries that get “Worldwide” banner
    $english_international = [ 'GB', 'IE', 'NL' ];

    // Localized translations
    $translations = [
        'FR' => '📦 Livraison gratuite dans le monde entier dès 2 rosins',
        'DE' => '📦 Weltweiter Gratisversand ab 2 Kolophonien!',
        'IT' => '📦 Spedizione gratuita in tutto il mondo con 2+ rosins',
        'ES' => '📦 Envío gratuito a todo el mundo en pedidos de 2+ rosins',
        'PT' => '📦 Envio mundial grátis em 2+ rosins',
        'NO' => '📦 Gratis frakt over hele verden ved kjøp av 2+ rosins',
        'IS' => '📦 Ókeypis heimsending við kaup á 2+ rosins',
        'JP' => '📦 日本への送料無料！',
        'KR' => '📦 한국으로 무료 배송！',
        'HK' => '📦 香港地區免運費！',
        'TW' => '📦 台灣地區免運費！',
        'CN' => '📦 全球满 2 个松香免运费！',
        'US' => '📦 Free US Shipping — Worldwide Free on 2+ Rosins!',
        'CA' => '📦 Free shipping to Canada!',
        'AU' => '📦 Free shipping to Australia!',
        'NZ' => '📦 Free shipping to New Zealand!',
        'UK' => '📦 Free shipping to UK on 2+ Rosins!',
    ];

    // Decide message
    if ( array_key_exists( $country, $translations ) ) {
        $message = $translations[ $country ];
    } elseif ( in_array( $country, $english_international, true ) || in_array( $country, $eu_countries, true ) ) {
        $message = '📦 Free Worldwide Shipping on 2+ Rosins!';
    } else {
        $message = '📦 Free US Shipping — Worldwide Free on 2+ Rosins!';
    }

    // Pass message to JS
    wp_add_inline_script(
        'jquery-core',
        "jQuery(function($){ $('.free-shipping-banner').text(" . json_encode( $message ) . "); });"
    );
} );
*/

/* Remove native spin buttons from WooCommerce quantity fields */
add_action('wp_head', function () {
    ?>
    <style>
        /* Chrome, Safari, Edge (WebKit) */
        .woocommerce .quantity input.qty::-webkit-outer-spin-button,
        .woocommerce .quantity input.qty::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        /* Firefox */
        .woocommerce .quantity input.qty {
            -moz-appearance: textfield;
        }
    </style>
    <?php
});

// PostHog analytics code
add_action('wp_head', function () {
    // skip PostHog for admin area or admin users
    if (is_admin() || (is_user_logged_in() && current_user_can('manage_options')))
        return; ?>
    <script> (function (t, e) { var o, n, p, r; if (e.__SV || (window.posthog && window.posthog.__loaded)) return; window.posthog = e; e._i = []; e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); if (o.length == 2) { t = t[o[0]]; e = o[1] } t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } p = t.createElement("script"); p.type = "text/javascript"; p.crossOrigin = "anonymous"; p.async = !0; p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"; r = t.getElementsByTagName("script")[0]; r.parentNode.insertBefore(p, r); var u = e; if (a !== undefined) u = e[a] = []; else a = "posthog"; u.people = u.people || []; u.toString = function (t) { var e = "posthog"; if (a !== "posthog") e += "." + a; return t || (e += " (stub)"), e }; u.people.toString = function () { return u.toString(1) + ".people (stub)" }; o = "init hi capture identify opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing".split(" "); for (n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]) }; e.__SV = 1; })(document, window.posthog || []);
        // Opt-out check
        if (window.location.search.includes('no_track=1')) { document.cookie = 'no_track=1; path=/; max-age=' + 86400; } if (document.cookie.indexOf('no_track=1') !== -1) { console.log('PostHog disabled'); } else { posthog.init('phc_PijI5cuRiN3xiFIgACLreTbysLyXnqNPzlEMvMnQpb', { api_host: 'https://bassmentrosin.com/8bgr5d', person_profiles: 'identified_only' }); } </script>
<?php });

function bassment_enqueue_email_script()
{
    wp_register_script('bassment-email', '', [], null, true);
    wp_enqueue_script('bassment-email');

    $user = 'bassmentrosin';
    $domain = 'gmail.com';
    $subject = rawurlencode('Order inquiry');
    $body = rawurlencode('Name, Address, Quantity, any questions:');

    $inline = "(function(){
	  const user='{$user}', domain='{$domain}',
	        subject='{$subject}', body='{$body}';
	  document.querySelectorAll('.bassment-email').forEach(el=>{
	    const link = el.querySelector('.bassment-email-link');
	    const disp = el.querySelector('.bassment-email-display');
	    if(!link || !disp) return;
	    const mailto='mailto:'+user+'@'+domain+'?subject='+subject+'&body='+body;
	    link.href=mailto;
	    link.textContent=disp.textContent;
	    link.setAttribute('aria-label',user+'@'+domain);
	    link.style.cursor='pointer';
	    disp.style.display='none';
	  });
	})();";
    wp_add_inline_script('bassment-email', $inline);
}
add_action('wp_enqueue_scripts', 'bassment_enqueue_email_script');

// === Shortcode with obfuscated domain ===
function bassment_email_shortcode($atts)
{
    $obfuscated_domain = '&#103;&#109;&#97;&#105;&#108;&#46;&#99;&#111;&#109;'; // "gmail.com"
    return '
	<span class="bassment-email">
	  <span class="bassment-email-display">bassmentrosin@' . $obfuscated_domain . '</span>
	  <a class="bassment-email-link" aria-hidden="true"></a>
	</span>';
}
add_shortcode('bassment_email', 'bassment_email_shortcode');

// Homepage add-to-cart pricing and shipping info
add_action('wp_print_footer_scripts', function () { ?>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const select = document.querySelector('#homepage-country-select');
            const block = document.querySelector('#product-price-block');
            if (!select || !block) return;

            const priceEl = block.querySelector('.br-price');
            const sublineEl = block.querySelector('.br-subline');
            const baseUSD = parseFloat(block.dataset.baseusd || 45);

            const data = {
                USD: { symbol: '$', rate: 1.00, round: 0.01 },
                EUR: { symbol: '€', rate: 0.87, round: 0.25 },
                GBP: { symbol: '£', rate: 0.76, round: 1 },
                CAD: { symbol: '$', rate: 1.40, round: 0.25 },
                NOK: { symbol: 'kr', rate: 10.2, round: 1 },
                SEK: { symbol: 'kr', rate: 9.50, round: 1 },
                CNY: { symbol: '¥', rate: 7.125, round: 0.5 },
                JPY: { symbol: '¥', rate: 151, round: 50 },
                KRW: { symbol: '₩', rate: 1400, round: 100 },
                TWD: { symbol: 'NT$', rate: 32, round: 10 },
                HKD: { symbol: '$', rate: 7.8, round: 0.25 },
                ISK: { symbol: 'kr', rate: 121.8, round: 25 },
                AUD: { symbol: '$', rate: 1.54, round: 1 },
                NZD: { symbol: '$', rate: 1.75, round: 1 },
                DKK: { symbol: 'kr', rate: 6.60, round: 1 },
                UAH: { symbol: '₴', rate: 33, round: 1 },
                CHF: { symbol: 'CHF ', rate: 0.8, round: 1 },
            };

            const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
            const map = Object.fromEntries(EU.map(c => [c, 'EUR']));
            Object.assign(map, {
                US: 'USD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', KR: 'KRW', TW: 'TWD', HK: 'HKD', CN: 'CNY',
                NO: 'NOK', IS: 'ISK', GB: 'GBP', UK: 'GBP', DK: 'DKK', UA: 'UAH', CH: 'CHF', SE: 'SEK',
            });

            const VAT_COUNTRIES = new Set([...EU, 'GB', 'UK', 'NO', 'IS']);
            const VATx = {
                AT: 1.20, BE: 1.21, BG: 1.20, HR: 1.25, CY: 1.19, CZ: 1.21, DK: 1.25, EE: 1.22, FI: 1.24,
                FR: 1.20, DE: 1.19, GR: 1.24, HU: 1.27, IE: 1.23, IT: 1.22, LV: 1.21, LT: 1.21, LU: 1.17,
                MT: 1.18, NL: 1.21, PL: 1.23, PT: 1.23, RO: 1.19, SK: 1.20, SI: 1.22, ES: 1.21, SE: 1.25,
                GB: 1.20, UK: 1.20, NO: 1.25
                // IS intentionally excluded from VAT multiplier (but still marked VAT incl)
            };

            const SHIPPING_CHARGE_COUNTRIES = new Set([...EU, 'GB', 'UK', 'NO', 'IS']);
            const SHIPPING_BASE_USD = 8;

            // === Translations (DISABLED but PRESERVED) ===
            /* const i18n = {
              en:{ vat:'VAT incl.', ship:'shipping', free:'free on 2+ rosins', free_ship:'Free shipping' },
              de:{ vat:'inkl. MwSt.', ship:'Versand', free:'gratis ab 2 Kolophonien', free_ship:'Kostenloser Versand' },
              fr:{ vat:'TVA incl.', ship:'livraison', free:'gratuite dès 2 colophanes', free_ship:'Livraison gratuite' },
              kr:{ vat:'부가세 포함', ship:'배송', free:'2개 이상 무료', free_ship:'무료 배송' },
              jp:{ vat:'税込', ship:'送料', free:'2個以上で無料', free_ship:'送料無料' },
              tw:{ vat:'含稅', ship:'運送', free:'購買兩個以上免運', free_ship:'免運費' },
              no:{ vat:'Inkl. MVA', ship:'frakt', free:'gratis ved 2+ rosiner', free_ship:'Gratis frakt' },
              se:{ vat:'inkl. moms', ship:'frakt', free:'fri frakt vid 2+ kådor', free_ship:'Fri frakt' },
              es:{ vat:'IVA incl.', ship:'envío', free:'gratis en pedidos de 2 o más resinas', free_ship:'Envío gratis' },
              ua:{ vat:'з ПДВ', ship:'доставка', free:'безкоштовно при замовленні від 2 каніфолей', free_ship:'Безкоштовна доставка' },
            };
 
            function langForCountry(cc){
              const lmap = {DE:'de', FR:'fr', KR:'kr', JP:'jp', HK:'tw', TW:'tw', NO:'no', SE:'se', ES:'es', UA:'ua',};
              return lmap[cc] || 'en';
            }
            */

            // REPLACEMENT: Single English Source of Truth
            const t = { vat: 'VAT incl.', ship: 'shipping', free: 'free on 2+ rosins', free_ship: 'Free shipping' };

            function ceilToStep(value, step) {
                return Math.ceil((value / step) - 1e-6) * step;
            }

            function asMoney(amount) {
                const isInt = Math.abs(amount - Math.round(amount)) < 1e-9;
                return isInt ? amount.toFixed(0) : amount.toFixed(2);
            }

            function formatKRWon(num) {
                const man = Math.floor(num / 10000);
                const rest = num % 10000;
                if (rest === 0) return `${man}만`;
                const chun = Math.floor(rest / 1000);
                if (chun > 0 && rest % 1000 === 0) return `${man}만${chun}천`;
                return `${man}만${rest}`;
            }

            // Modified: removed `lang` parameter
            function fmt(amount, currency, showVAT) {
                // const t = i18n[lang]||i18n.en; // DISABLED
                const cfg = data[currency] || data.USD;
                let txt;
                if (currency === 'KRW') { txt = `${cfg.symbol}${formatKRWon(Math.round(amount))}`; }
                else txt = `${cfg.symbol}${asMoney(amount)}`;

                // Uses global 't' object now
                if (showVAT) txt += ` <span style="font-size:15px;color:#bbb;">${t.vat}</span>`;
                if (cfg.symbol === '$' && currency !== 'USD') txt += ` <span style="font-size:16px;color:#BBB;">(${currency})</span>`;
                return { txt, suffix: '', cfg };
            }

            function render(country) {
                const cc = (country || 'US').toUpperCase();
                const currency = map[cc] || 'USD';
                const isVAT = VAT_COUNTRIES.has(cc);

                // const lang=langForCountry(cc); // DISABLED
                // const t=i18n[lang]||i18n.en;   // DISABLED

                const EU_MARKUP = 1.11;
                const CH_MARKUP = 1.15;
                const PRICE_MARKUP_COUNTRIES = [...EU, 'NO'];

                const rate = data[currency]?.rate || 1;
                const step = data[currency]?.round || 0.01;
                let mult = 1;
                if (cc === 'CH') {
                    mult = CH_MARKUP;
                } else if (PRICE_MARKUP_COUNTRIES.includes(cc)) {
                    mult = EU_MARKUP;
                }

                const priceConvertedRounded = ceilToStep(baseUSD * rate * mult, step);

                // Modified: removed passing `lang`
                const p = fmt(priceConvertedRounded, currency, isVAT);

                if (priceEl) priceEl.innerHTML = `<span class="woocommerce-Price-amount amount"><bdi>${p.txt}</bdi></span>${p.suffix}`; //`tik comment needed to fix syntax highlighting

            // 1. Default state
            let shippingHTML = t.free_ship;

            // 2. Define Express Countries
            const EXPRESS_COUNTRIES = ['AT', 'DE', 'BE', 'DK', 'ES', 'FI', 'FR', 'GR', 'IE', 'IT', 'LU', 'NL', 'PT', 'SE', 'NO', 'CH'];
            const isExpressCountry = EXPRESS_COUNTRIES.includes(cc);
            const expressTag = isExpressCountry ? `⚡&nbsp;Express&nbsp;` : '';

            // 3. Logic for PAID shipping countries (EU, UK, NO, etc.)
            if (SHIPPING_CHARGE_COUNTRIES.has(cc)) {
                let useShipBase = isExpressCountry ? 10 : SHIPPING_BASE_USD;

                const shipBaseConvertedRounded = ceilToStep(useShipBase * rate, step);
                const vatMult = VATx[cc] || 1;
                const shipWithVAT = shipBaseConvertedRounded * vatMult;

                const s = fmt(shipWithVAT, currency, false);

                // Result: "€8.00 ⚡ Express shipping — free on 2+ rosins"
                shippingHTML = `${s.txt}${s.suffix}&nbsp;${expressTag}${t.ship}&nbsp;&mdash;&nbsp;${t.free}`;
            }
            // 4. Logic for FREE shipping countries that are EXPRESS (like Switzerland)
            else if (isExpressCountry) {
                // Result: "⚡ Express Free shipping"
                shippingHTML = `${expressTag}${t.free_ship}`;
            }

            if (sublineEl) sublineEl.innerHTML = shippingHTML;
        }

        if (select.value) render(select.value);
        select.addEventListener('change', () => render(select.value));
    });
</script>
<?php });
/**
 * BR Regional Price Multiplier Logic (Moved from Plugin)
 * Multiplies base price by 1.11 for EU countries, plus Norway.
 */

if (!defined('ABSPATH'))
    exit;

/**
 * --- 1. Country utilities - Including Norway for Multiplier ---
 */
function br_rpm_euish_list()
{
    // EU countries receiving the multiplier
    $eu_countries = [
        'AT',
        'BE',
        'BG',
        'HR',
        'CY',
        'CZ',
        'DK',
        'EE',
        'FI',
        'FR',
        'DE',
        'GR',
        'HU',
        'IE',
        'IT',
        'LV',
        'LT',
        'LU',
        'MT',
        'NL',
        'PL',
        'PT',
        'RO',
        'SK',
        'SI',
        'ES',
        'SE'
    ];

    // Countries receiving the multiplier but NOT treated as EU for currency/taxes (Norway)
    $non_eu_multiplier_countries = [
        'NO' // Norway added here for 1.11 multiplier
    ];

    return array_merge($eu_countries, $non_eu_multiplier_countries);
}

function br_rpm_is_euish($cc)
{
    return in_array(strtoupper((string) $cc), br_rpm_euish_list(), true);
}

function br_rpm_is_ch($cc)
{
    return strtoupper((string) $cc) === 'CH';
}

function br_rpm_current_country()
{
    // 1. Checkout-posted country
    foreach (['shipping_country', 'billing_country'] as $key) {
        if (isset($_POST[$key]) && $_POST[$key] !== '') {
            return strtoupper(wc_clean(wp_unslash($_POST[$key])));
        }
    }

    // 2. Customer session
    if (function_exists('WC') && WC()->customer) {
        $cc = WC()->customer->get_shipping_country() ?: WC()->customer->get_billing_country();
        if ($cc)
            return strtoupper($cc);
    }

    // 3. Geolocation fallback
    if (class_exists('WC_Geolocation')) {
        $geo = WC_Geolocation::geolocate_ip();
        if (!empty($geo['country']))
            return strtoupper($geo['country']);
    }

    return '';
}

/**
 * --- 2. Apply multiplier for EUish visitors ---
 */
function br_rpm_adjust_price($price, $product)
{
    if (is_admin() && !defined('DOING_AJAX'))
        return $price;
    if (!is_numeric($price))
        return $price;

    $country = br_rpm_current_country();

    if (br_rpm_is_ch($country)) {
        $price = (float) $price * 1.15; // Switzerland specific
    } elseif (br_rpm_is_euish($country)) {
        $price = (float) $price * 1.11; // EU + Norway
    }

    return $price;
}
add_filter('woocommerce_product_get_price', 'br_rpm_adjust_price', 15, 2);
add_filter('woocommerce_product_get_regular_price', 'br_rpm_adjust_price', 15, 2);
add_filter('woocommerce_product_get_sale_price', 'br_rpm_adjust_price', 15, 2);

/**
 * --- 3. Force WooCommerce to recalc with this logic on AJAX/cart refresh ---
 * (ensures totals stay correct when quantity or country changes)
 */
add_action('woocommerce_before_calculate_totals', function () {
    if (is_admin() && !wp_doing_ajax())
        return;

    $country = br_rpm_current_country();

    // Run if country is either EUish OR Switzerland
    if (br_rpm_is_euish($country) || br_rpm_is_ch($country)) {
        add_filter('woocommerce_product_get_price', 'br_rpm_adjust_price', 15, 2);
        add_filter('woocommerce_product_get_regular_price', 'br_rpm_adjust_price', 15, 2);
        add_filter('woocommerce_product_get_sale_price', 'br_rpm_adjust_price', 15, 2);
    }
}, 1);
// =======================
// Bassment FAQ – EN + DE with dynamic switch (no reload)
// =======================
add_shortcode('bassment_faq', function () {

    // Supported languages
    $langs = [
        'en' => 'English',
        'de' => 'Deutsch',
        'fr' => 'Français',
        'kr' => '한국어',
        'jp' => '日本語',
        'no' => 'Norsk',
        'sv' => 'Svenska',
        'tw' => '繁體中文',
    ];


    // Detect country via WooCommerce GeoIP (same logic you use elsewhere)
    $country = '';
    if (class_exists('WC_Geolocation')) {
        $geo = WC_Geolocation::geolocate_ip();
        $country = strtoupper($geo['country'] ?? '');
    }

    $default_lang = 'en';

    // JS will start with this language
    $initial_lang = esc_js($default_lang);

    $cookie_lang = isset($_COOKIE['bassment_lang']) ? sanitize_text_field($_COOKIE['bassment_lang']) : '';
    $initial_lang = array_key_exists($cookie_lang, $langs) ? $cookie_lang : $default_lang;

    // Raw content with shortcodes allowed, grouped by FAQ question key
    $faq_by_question = [
        'winter_year_round' => [
            'en' => [
                'q' => 'Can I use Winter bass rosin year round?',
                'a' => 'Yes. Winter solves the problem of weak, powdery rosin in cold/dry weather but can work fine the rest of the year for indoor temps below 76°F. Above 78°F/25°C it softens and can lose grip — in that case, add a few swipes of a harder or more powdery rosin (old Pops, Kolstein, Nymans, or even violin/viola/cello rosin), play it in briefly, and wipe the strings. In very hot summer climates it’s best to set Winter aside until cooler weather.'
            ],
            'fr' => [
                'q' => 'Puis-je utiliser la colophane pour contrebasse Winter toute l’année ?',
                'a' => 'Oui. Winter résout le problème des colophanes faibles et poudreuses par temps froid ou sec, mais elle fonctionne aussi très bien le reste de l’année. Au-delà de 25 °C, elle devient plus souple et peut perdre un peu d’adhérence — dans ce cas, appliquez quelques coups d’une colophane plus dure ou plus sèche (ancienne Pops, Kolstein, Nyman ou même colophane pour violon/alto/violoncelle), jouez quelques instants puis essuyez les cordes. Dans les climats très chauds, il est préférable de mettre Winter de côté jusqu’à un temps plus frais.'
            ],
            'de' => [
                'q' => 'Kann ich Winter-Bassharz das ganze Jahr über verwenden?',
                'a' => 'Ja. Winter löst das Problem von schwachem, pudrigem Harz bei kaltem oder trockenem Wetter, funktioniert aber auch den Rest des Jahres zuverlässig. Über 25 °C (78 °F) wird es weicher und kann an Griff verlieren – in dem Fall einfach ein paar Striche eines härteren oder trockeneren Harzes (z. B. altes Pops, Kolstein, Nyman oder sogar Geigen-/Bratschen-/Celloharz) darüberziehen, kurz einspielen und die Saiten abwischen. In sehr heißen Sommerregionen empfiehlt es sich, Winter bis zu kühlerem Wetter beiseitezulegen.'
            ],
            'jp' => [
                'q' => 'Winterのコントラバス松脂は一年中使えますか？',
                'a' => 'はい。Winterは寒く乾燥した季節に起こる「粉っぽく弱い松脂」の問題を解決しますが、他の季節でも問題なく使用できます。摂氏25度（華氏78度）を超えると柔らかくなり、グリップが弱くなる場合があります。その場合は、より硬めまたは乾いた松脂（古いPops、Kolstein、Nyman、またはヴァイオリン／ヴィオラ／チェロ用松脂など）を少し重ねて塗り、短く弾いてから弦を拭いてください。非常に暑い夏の環境では、気温が下がるまでWinterの使用を控えるのが最適です。'
            ],
            'no' => [
                'q' => 'Kan jeg bruke Winter-bassharpiks hele året?',
                'a' => 'Ja. Winter løser problemet med svak og pulveraktig harpiks i kaldt eller tørt vær, men fungerer fint resten av året også. Over 25 °C kan den bli mykere og miste litt grep – da kan du legge på noen strøk med en hardere eller tørrere harpiks (for eksempel gammel Pops, Kolstein, Nyman eller til og med fiolin-/bratsj-/cello-harpiks), spille den inn kort og tørke strengene. I svært varme sommerklima er det best å legge Winter til side til været blir kjøligere.'
            ],
            'tw' => [
                'q' => '我可以全年使用 Winter 低音松香嗎？',
                'a' => '可以。Winter 解決了在寒冷或乾燥天氣中松香太弱、太粉的問題，但在其他季節也表現良好。超過 25 °C 時會變軟、抓力減弱——這種情況下可再塗幾下較硬或較乾的松香（如舊的 Pops、Kolstein、Nyman，或小提琴／中提琴／大提琴松香），簡單拉幾下並擦拭琴弦即可。在炎熱的夏天建議暫時不用 Winter，等天氣轉涼再使用。'
            ],
            'sv' => [
                'q' => 'Kan jag använda Winter-basrosin året runt?',
                'a' => 'Ja. Winter löser problemet med svagt, pudrigt rosin i kallt eller torrt väder men fungerar bra resten av året också. Vid temperaturer över 25 °C blir det mjukare och kan tappa grepp – lägg då på några drag av ett hårdare eller torrare rosin (t.ex. gammalt Pops, Kolstein, Nyman eller violin-/altfiol-/cellorosin), spela in det kort och torka strängarna. I mycket varmt klimat är det bäst att lägga undan Winter tills det blir svalare.'
            ],
            'kr' => [
                'q' => 'Winter 베이스 송진을 1년 내내 사용할 수 있나요?',
                'a' => '가능합니다. Winter는 추운 날씨나 건조한 환경에서 송진이 약하거나 가루처럼 되는 문제를 해결하지만, 다른 계절에도 잘 작동합니다. 25 °C 이상에서는 약간 부드러워지고 그립이 줄어들 수 있습니다. 이럴 때는 조금 더 단단하거나 건조한 송진(예: 오래된 Pops, Kolstein, Nyman 또는 바이올린/비올라/첼로 송진)을 약간 덧바르고 잠깐 연주한 뒤 줄을 닦아주세요. 매우 더운 여름에는 날씨가 시원해질 때까지 Winter를 보관하는 것이 좋습니다.'
            ],
        ],
        'winter_vs_pops_kolstein' => [
            'en' => [
                'q' => 'How does Winter compare to Pops or Kolstein?',
                'a' => 'On soft or slow strokes, Winter has less initial bite on the string compared to Pops or Kolstein. As strokes get louder or faster, Winter immediately responds with solid, punchy grab on the string. Pops and Kolstein pioneered sustained grab decades ago, but they still powder and dry out. For players who prefer a stickier or stronger feeling rosin even in soft or slow passages, just add a swipe of Pops or Kolstein on top to keep that familiar feel.'
            ],
            'fr' => [
                'q' => 'Comment Winter se compare-t-elle à Pops ou Kolstein ?',
                'a' => 'Sur les coups d’archet doux ou lents, Winter offre moins de mordant initial sur la corde que Pops ou Kolstein. Dès que le jeu s’intensifie ou s’accélère, Winter réagit immédiatement avec une accroche solide et percutante. Pops et Kolstein ont été les pionniers du grip durable il y a plusieurs décennies, mais elles ont toujours tendance à sécher et à poudrer. Pour les musiciens qui préfèrent une sensation plus collante ou plus forte même dans les passages doux, il suffit d’ajouter un coup de Pops ou Kolstein par-dessus pour conserver cette sensation familière.'
            ],
            'de' => [
                'q' => 'Wie vergleicht sich Winter mit Pops oder Kolstein?',
                'a' => 'Bei weichen oder langsamen Strichen hat Winter etwas weniger anfänglichen Biss in der Saite als Pops oder Kolstein. Sobald die Striche jedoch lauter oder schneller werden, antwortet Winter sofort mit einem festen, kernigen Griff. Pops und Kolstein haben vor Jahrzehnten die anhaltende Haftung geprägt, neigen aber immer noch zum Austrocknen und Pudern. Wer auch in weichen Passagen ein klebrigeres oder stärkeres Spielgefühl bevorzugt, kann einfach einen Strich Pops oder Kolstein darüberziehen, um das gewohnte Gefühl zu behalten.'
            ],
            'jp' => [
                'q' => 'WinterはPopsやKolsteinと比べてどうですか？',
                'a' => '柔らかくゆっくりとしたボウイングでは、WinterはPopsやKolsteinに比べて初期の食いつき（バイト感）が控えめです。しかし、ボウイングが強く、または速くなると、Winterは即座に反応し、ソリッドでパンチのあるグリップ力を発揮します。PopsやKolsteinは数十年前に持続的なグリップを確立しましたが、依然として乾燥や粉の問題があります。柔らかいパッセージでも、より粘りのある、あるいは強い抵抗感を好む奏者は、PopsやKolsteinをひと塗り重ねるだけで、その馴染みのある感触を維持できます。'
            ],
            'no' => [
                'q' => 'Hvordan sammenlignes Winter med Pops eller Kolstein?',
                'a' => 'Ved myke eller langsomme strøk har Winter litt mindre innledende bitt i strengen sammenlignet med Pops eller Kolstein. Når strøkene blir kraftigere eller raskere, svarer Winter umiddelbart med et solid og kontant grep. Pops og Kolstein var pionerer innen varig grep for flere tiår siden, men de tørker fortsatt ut og pudrer. For musikere som foretrekker en seigere eller sterkere følelse også i svake partier, er det bare å legge et strøk Pops eller Kolstein på toppen for å beholde den kjente følelsen.'
            ],
            'tw' => [
                'q' => 'Winter 與 Pops 或 Kolstein 相比如何？',
                'a' => '在輕柔或緩慢的運弓時，Winter 對琴弦的初始咬合感（bite）比 Pops 或 Kolstein 稍弱。但當運弓變強或變快時，Winter 會立即反應，提供紮實且有力的抓弦感。Pops 與 Kolstein 幾十年前就開創了持久抓力的先河，但它們仍容易乾裂與掉粉。如果你偏好在輕柔樂段中也要有較黏或較強的阻力感，只需在表層塗抹一下 Pops 或 Kolstein，就能保持那種熟悉的手感。'
            ],
            'sv' => [
                'q' => 'Hur jämförs Winter med Pops eller Kolstein?',
                'a' => 'Vid mjuka eller långsamma stråk har Winter något mindre initialt bett i strängen jämfört med Pops eller Kolstein. När stråken rör sig snabbare eller starkare svarar Winter dock omedelbart med ett fast och kraftfullt grepp. Pops och Kolstein skapade hållbart grepp redan för decennier sedan, men de torkar fortfarande ut och blir pudriga. För musiker som föredrar en klibbigare eller starkare känsla även i svaga passager, räcker det med att lägga ett drag Pops eller Kolstein ovanpå för att behålla den välbekanta känslan.'
            ],
            'kr' => [
                'q' => 'Winter는 Pops나 Kolstein과 어떻게 다른가요?',
                'a' => '부드럽거나 느린 보잉에서는 Winter가 Pops나 Kolstein에 비해 현에 대한 초기 반응(bite)이 덜할 수 있습니다. 하지만 연주가 강해지거나 빨라지면, Winter는 즉각적으로 반응하여 단단하고 펀치감 있는 그립을 제공합니다. Pops와 Kolstein은 수십 년 전부터 지속적인 그립을 개척했지만, 여전히 건조해지고 가루가 날리는 단점이 있습니다. 부드러운 패시지에서도 더 끈적하거나 강한 느낌을 선호하는 연주자라면, 그 위에 Pops나 Kolstein을 한 번 덧발라 익숙한 감각을 유지할 수 있습니다.'
            ],
        ],
        'winter_vs_other_new_rosins' => [
            'en' => [
                'q' => 'What makes Winter different from other new bass rosins that only feel good for a short time?',
                'a' => 'Other new bass rosins seem to follow the violin-rosin-plus-softener model, assuming that surface tack means better grip. In practice, that softness breaks down fast and leaves a powdery residue that blocks real contact with the string. Winter is built differently. Its lasting grab comes from stability, not softness, so it keeps grabbing cleanly through long playing and changing conditions without turning to powder.'
            ],
            'fr' => [
                'q' => 'Qu’est-ce qui rend Winter différente des autres nouvelles colophanes pour contrebasse qui ne donnent une bonne sensation que pendant un court moment ?',
                'a' => 'Beaucoup de nouvelles colophanes pour contrebasse suivent le modèle « colophane de violon + assouplissant », en pensant que plus la surface est collante, meilleur est le grip. En réalité, cette souplesse se dégrade rapidement et laisse un résidu poudreux qui empêche un vrai contact avec la corde. Winter est conçue autrement : sa prise durable vient de la stabilité, pas de la mollesse, ce qui lui permet de conserver une adhérence propre et régulière pendant de longues séances et sous des conditions changeantes, sans devenir poudreuse ni collante.'
            ],
            'de' => [
                'q' => 'Was unterscheidet Winter von anderen neuen Bassharzen, die nur eine kurze Zeit gut funktionieren?',
                'a' => 'Viele neue Bassharze orientieren sich am Modell „Geigenharz plus Weichmacher“ und gehen davon aus, dass mehr Oberflächenklebrigkeit besseren Halt bedeutet. In der Praxis zerfällt diese Weichheit jedoch schnell und hinterlässt ein pudriges Rückstand, das den direkten Kontakt mit der Saite blockiert. Winter ist anders aufgebaut: Die dauerhafte Haftung entsteht durch Stabilität, nicht durch Weichheit, und bleibt über lange Spielzeiten und wechselnde Bedingungen gleichmäßig erhalten, ohne zu pudern oder zu schmieren.'
            ],
            'jp' => [
                'q' => 'Winterは、短時間しか良い感触が続かない他の新しいコントラバス松脂と何が違うのですか？',
                'a' => '多くの新しいコントラバス松脂は「ヴァイオリン松脂＋柔軟剤」の発想に基づいており、表面の粘着性が強ければグリップも強いと考えています。しかし実際には、その柔らかさはすぐに崩れ、粉状の残留物が弦との本当の接触を妨げてしまいます。Winterはまったく異なる設計です。長く続くグリップ力は柔らかさではなく安定性から生まれ、長時間の演奏や環境の変化にも強く、粉やべたつきに変化することなくクリーンな弾き心地を保ちます。'
            ],
            'no' => [
                'q' => 'Hva gjør Winter annerledes enn andre nye bassharpikser som bare føles gode en kort stund?',
                'a' => 'Mange nye bassharpikser følger modellen med fiolinharsk pluss mykner og tror at klebrighet betyr bedre grep. I praksis brytes den mykheten raskt ned og etterlater et pudderlag som hindrer ekte kontakt med strengen. Winter er bygget annerledes. Det varige grepet kommer av stabilitet, ikke mykhet, slik at det holder seg rent og jevnt gjennom lange økter og skiftende forhold uten å bli til pudder eller kliss.'
            ],
            'tw' => [
                'q' => 'Winter 與其他只在短時間內手感良好的新款低音松香有何不同？',
                'a' => '許多新款低音松香遵循「小提琴松香＋軟化劑」的配方，誤以為表面黏性代表更好的抓力。實際上那種軟化會很快分解，留下粉末殘留物，阻礙與琴弦的真實接觸。Winter 的配方不同：它的持久抓力來自穩定性，而非柔軟度，因此能在長時間演奏與不同環境下保持乾淨穩定的附著力，不會變成粉末或黏膩物。'
            ],
            'sv' => [
                'q' => 'Vad gör Winter annorlunda jämfört med andra nya basrosiner som bara känns bra en kort stund?',
                'a' => 'Många nya basrosin följer modellen “fiolrosin plus mjukgörare” och tror att mer klibbighet betyder bättre grepp. I praktiken bryts den mjukheten snabbt ned och lämnar ett pudrigt lager som hindrar riktig kontakt med strängen. Winter är byggt annorlunda – det varaktiga greppet kommer från stabilitet, inte mjukhet, så det håller sig rent och konsekvent under långa spelpass och varierande förhållanden utan att bli till pulver eller kladd.'
            ],
            'kr' => [
                'q' => 'Winter는 처음에만 좋은 다른 새로운 베이스 송진과 무엇이 다른가요?',
                'a' => '많은 새로운 베이스 송진은 “바이올린 송진 + 연화제” 방식으로 만들어져 표면의 끈적임이 좋은 그립이라고 착각합니다. 실제로는 그 부드러움이 금방 무너져 가루가 되어 줄과의 실제 접촉을 방해합니다. Winter는 다르게 설계되었습니다. 지속적인 그립은 부드러움이 아니라 안정성에서 나오며, 장시간 연주나 다양한 환경에서도 깨끗하고 일정한 그립을 유지합니다.'
            ],
        ],
        'winter_storage' => [
            'en' => [
                'q' => 'Do I need to store Winter in a fancy humidity container?',
                'a' => 'No. I purposefully designed Winter to not be affected by air or humidity - only temperature. You can leave Winter out uncovered all the time and it will still play the same. But probably best to keep it covered since it would collect dust like any piece of furniture.'
            ],
            'fr' => [
                'q' => 'Dois-je conserver Winter dans un étui humidificateur sophistiqué ?',
                'a' => 'Non. J’ai conçu Winter spécifiquement pour qu’elle ne soit pas affectée par l’air ou l’humidité, mais seulement par la température. Vous pouvez la laisser à l’air libre tout le temps, elle se jouera toujours de la même façon. Mais il vaut probablement mieux la couvrir, car elle prendrait la poussière comme n’importe quel meuble.'
            ],
            'de' => [
                'q' => 'Muss ich Winter in einem speziellen Feuchtigkeitsbehälter aufbewahren?',
                'a' => 'Nein. Ich habe Winter bewusst so entwickelt, dass sie von Luft oder Feuchtigkeit unbeeindruckt bleibt – nur die Temperatur spielt eine Rolle. Du kannst sie ständig offen liegen lassen, und sie spielt sich immer noch gleich. Aber es ist wahrscheinlich besser, sie abzudecken, da sie sonst wie jedes Möbelstück Staub ansetzt.'
            ],
            'jp' => [
                'q' => 'Winterは特別な湿度管理容器に保管する必要がありますか？',
                'a' => 'いいえ。Winterは空気や湿度の影響を受けず、温度だけに反応するように意図的に設計しました。蓋を開けたまま放置しても、変わらず演奏できます。ただ、家具と同じように埃をかぶってしまうため、保管時は蓋をしておくのがベストでしょう。'
            ],
            'no' => [
                'q' => 'Må jeg oppbevare Winter i en avansert fuktbeholder?',
                'a' => 'Nei. Jeg designet Winter med vilje slik at den ikke påvirkes av luft eller luftfuktighet – bare temperatur. Du kan la den ligge utildekket hele tiden, og den vil fortsatt fungere like bra. Men det er nok best å dekke den til, siden den ellers vil samle støv akkurat som et møbel.'
            ],
            'tw' => [
                'q' => '我需要把 Winter 放在特別的保濕容器裡嗎？',
                'a' => '不用。我特意設計讓 Winter 不受空氣或濕度影響——只有溫度會有影響。你可以一直讓它開蓋暴露在空氣中，演奏性能依然不變。不過最好還是蓋上，因為就像任何家具一樣，它久了會積灰塵。'
            ],
            'sv' => [
                'q' => 'Behöver jag förvara Winter i en avancerad fuktbehållare?',
                'a' => 'Nej. Jag designade avsiktligt Winter för att inte påverkas av luft eller luftfuktighet – bara temperatur. Du kan låta den ligga öppen hela tiden och den kommer fortfarande att fungera likadant. Men det är nog bäst att ha locket på, eftersom den annars samlar damm precis som en möbel.'
            ],
            'kr' => [
                'q' => 'Winter를 특별한 습도 조절 용기에 보관해야 하나요?',
                'a' => '아니요. 저는 Winter가 공기나 습기의 영향을 받지 않고, 오직 온도에만 반응하도록 의도적으로 설계했습니다. 뚜껑을 열어둔 채로 계속 방치해도 여전히 똑같은 상태로 연주할 수 있습니다. 다만 가구처럼 먼지가 쌓일 수 있으니 덮어두는 것이 가장 좋습니다.'
            ],
        ],
        'rehair_before_switching' => [
            'en' => [
                'q' => 'Do I need a rehair before switching to Winter?',
                'a' => 'No rehair needed. You can feel Winter’s benefits immediately, even on old hair. If your bow is powdery, add a few swipes, play briefly, then wipe the strings. Repeat once or twice until you’re happy with the feel and sound.'
            ],
            'fr' => [
                'q' => 'Dois-je refaire le crin de mon archet avant de passer à Winter ?',
                'a' => 'Non, ce n’est pas nécessaire. Vous ressentirez immédiatement les avantages de Winter, même sur un archet ancien. Si votre archet semble poudreux, appliquez quelques coups, jouez brièvement, puis essuyez les cordes. Répétez une ou deux fois jusqu’à obtenir la sensation et le son souhaités.'
            ],
            'de' => [
                'q' => 'Brauche ich einen neuen Bogenbezug, bevor ich auf Winter umsteige?',
                'a' => 'Nein, ein Rehair ist nicht nötig. Die Vorteile von Winter sind sofort spürbar, auch auf älterem Haar. Wenn dein Bogen pudrig spielt, einfach ein paar Striche Winter auftragen, kurz einspielen und die Saiten abwischen. Wiederhole das ein- oder zweimal, bis sich der gewünschte Griff und Klang einstellen.'
            ],
            'jp' => [
                'q' => 'Winterに切り替える前に弓の毛替えをする必要がありますか？',
                'a' => 'いいえ、必要ありません。古い弓毛でもWinterの効果はすぐに実感できます。弓が粉っぽく感じる場合は、数回塗って短く弾き、弦を拭いてください。感触と音に満足するまで1〜2回繰り返してください。'
            ],
            'no' => [
                'q' => 'Trenger jeg å rehair’e buen før jeg bytter til Winter?',
                'a' => 'Nei, det trengs ikke. Du merker fordelene med Winter umiddelbart, selv på eldre buehår. Hvis buen føles pudret, legg på noen strøk, spill litt og tørk strengene. Gjenta en eller to ganger til du er fornøyd med følelsen og lyden.'
            ],
            'tw' => [
                'q' => '換用 Winter 前需要重新上馬尾嗎？',
                'a' => '不需要。即使在舊弓毛上，你也能立即感受到 Winter 的效果。如果弓毛太粉，只需塗幾下、拉幾下、再擦弦即可。重複一兩次，直到手感與聲音達到理想狀態。'
            ],
            'sv' => [
                'q' => 'Behöver jag byta tagel innan jag byter till Winter?',
                'a' => 'Nej, inget nytt tagel behövs. Du känner fördelarna direkt, även på äldre tagel. Om stråken känns pudrig, lägg på några drag, spela lite och torka strängarna. Upprepa en eller två gånger tills greppet känns rätt.'
            ],
            'kr' => [
                'q' => 'Winter로 바꾸기 전에 리헤어가 필요하나요?',
                'a' => '필요 없습니다. 오래된 활털에서도 Winter의 장점을 바로 느낄 수 있습니다. 활이 가루처럼 느껴진다면 몇 번 바르고 잠깐 연주한 후 줄을 닦으세요. 원하는 그립감과 소리가 나올 때까지 한두 번 반복하면 됩니다.'
            ],
        ],
        'new_rehair_less_grip' => [
            'en' => [
                'q' => 'Winter is not gripping as well right after a rehair as it did before. Did I do something wrong?',
                'a' => 'Winter alone can be a bit too “soft” to break in new hair during warmer times of the year. Getting the bow started with a harder/drier rosin (old Pops or Kolstein, etc.) can help get the hair going so that you don’t end up with the lack of grab that comes from over-rosining.'
            ],
            'fr' => [
                'q' => 'Winter n’adhère pas aussi bien juste après un nouveau rehair qu’avant. Ai-je fait quelque chose de mal ?',
                'a' => 'Winter seule peut être un peu trop « souple » pour roder des crins neufs pendant les périodes chaudes. Commencer avec une colophane plus dure ou plus sèche (ancienne Pops ou Kolstein, par exemple) aide à amorcer le crin et évite le manque de grip causé par un excès de colophane.'
            ],
            'de' => [
                'q' => 'Winter greift nach einer Neubespannung nicht so gut wie vorher. Habe ich etwas falsch gemacht?',
                'a' => 'Winter allein kann in warmen Monaten etwas zu „weich“ sein, um neues Haar einzuspielen. Ein paar Striche eines härteren oder trockeneren Harzes (z. B. altes Pops oder Kolstein) helfen, das Haar in Gang zu bringen und den Mangel an Grip durch Überharzen zu vermeiden.'
            ],
            'jp' => [
                'q' => '毛替え直後、Winterのグリップが以前より弱く感じます。何か間違えたのでしょうか？',
                'a' => '暖かい時期は、Winterだけでは新しい弓毛の「慣らし」に少し柔らかすぎる場合があります。古いPopsやKolsteinなど、より硬く乾いた松脂で弓毛を慣らすと、グリップ不足や塗りすぎによる滑りを防ぐことができます。'
            ],
            'no' => [
                'q' => 'Winter griper ikke like godt rett etter en ny rehair som før. Gjorde jeg noe galt?',
                'a' => 'Winter alene kan være litt for «myk» til å spille inn nytt hår i varmere perioder. Å starte med en hardere/tørrere harpiks (for eksempel gammel Pops eller Kolstein) hjelper hårene i gang slik at du unngår manglende grep fra for mye harpiks.'
            ],
            'tw' => [
                'q' => '換新弓毛後，Winter 抓力變差，是我弄錯了嗎？',
                'a' => '在較溫暖的天氣裡，單用 Winter 可能稍顯「太軟」，不易開弓。可以先用較硬或乾的松香（如舊的 Pops 或 Kolstein）幫助弓毛「開張」，避免因過多松香造成的滑感。'
            ],
            'sv' => [
                'q' => 'Winter greppar inte lika bra direkt efter en omtagling som tidigare. Har jag gjort fel?',
                'a' => 'Winter kan vara lite för “mjukt” för att spela in nytt tagel i varmare väder. Börja med ett hårdare/torrare rosin (t.ex. gammalt Pops eller Kolstein) så att taglet kommer igång och du undviker för mycket rosin.'
            ],
            'kr' => [
                'q' => '리헤어 후에는 Winter의 그립이 예전보다 약한데, 잘못된 건가요?',
                'a' => '더운 시기에는 Winter가 약간 “부드럽게” 느껴져 새 활털을 길들이기에 충분하지 않을 수 있습니다. 이럴 땐 좀 더 단단하거나 건조한 송진(예: 오래된 Pops 또는 Kolstein)을 먼저 사용해 활털을 길들이면 과도한 송진으로 인한 미끄러움을 피할 수 있습니다.'
            ],
        ],
        'shipping_country' => [
            'en' => [
                'q' => 'Do you ship to my country?',
                'a' => 'Yes! The countries in the menu above are just the ones already setup with automated checkout.<br><br>Shipping is still free worldwide when you order 2+ rosins.<br><br>If your country isn’t listed, just email me and I’ll confirm shipping and any customs fees so there are no surprises: <strong>[bassment_email]</strong>'
            ],
            'fr' => [
                'q' => 'Expédiez-vous dans mon pays ?',
                'a' => 'Oui ! Les pays dans le menu ci-dessus sont simplement ceux qui disposent déjà d’un paiement automatisé.<br><br>La livraison reste gratuite dans le monde entier à partir de 2 colophanes.<br><br>Si votre pays n’est pas listé, envoyez-moi un e-mail et je confirmerai les frais d’expédition et de douane pour éviter toute surprise : <strong>[bassment_email]</strong>'
            ],
            'de' => [
                'q' => 'Versendest du in mein Land?',
                'a' => 'Ja! Die Länder im Menü oben sind nur jene mit automatisiertem Checkout.<br><br>Der Versand ist weltweit kostenlos, wenn du 2 oder mehr Harze bestellst.<br><br>Falls dein Land nicht aufgeführt ist, schreib mir einfach – ich bestätige Versand und eventuelle Zollgebühren, damit es keine Überraschungen gibt: <strong>[bassment_email]</strong>'
            ],
            'jp' => [
                'q' => '海外への発送は可能ですか？',
                'a' => 'はい！上のメニューに表示されている国は、すでに自動チェックアウトが設定されている国のみです。<br><br>2個以上のご注文で全世界送料無料となります。<br><br>リストにない国の場合は、メールでご連絡ください。送料や関税の有無を確認し、追加費用が発生しないようご案内いたします：<strong>[bassment_email]</strong>'
            ],
            'no' => [
                'q' => 'Sender du til mitt land?',
                'a' => 'Ja! Landene i menyen ovenfor er bare de som allerede har automatisk utsjekk.<br><br>Frakten er fortsatt gratis over hele verden når du bestiller 2 + harpikser.<br><br>Hvis landet ditt ikke er oppført, send meg en e-post så bekrefter jeg frakt og eventuelle tollavgifter slik at det ikke blir overraskelser: <strong>[bassment_email]</strong>'
            ],
            'tw' => [
                'q' => '是否寄送到我的國家？',
                'a' => '會的！上方選單中的國家只是已啟用自動結帳的部分。<br><br>訂購兩盒以上仍享全球免運。<br><br>若未列出你的國家，請直接寄信給我確認運費與關稅，避免任何意外：<strong>[bassment_email]</strong>'
            ],
            'sv' => [
                'q' => 'Skickar du till mitt land?',
                'a' => 'Ja! Länderna i menyn ovan är bara de som redan har automatisk kassa.<br><br>Frakten är fortfarande gratis över hela världen när du beställer 2 + rosiner.<br><br>Om ditt land inte finns med, mejla mig så bekräftar jag frakt och eventuella tullavgifter: <strong>[bassment_email]</strong>'
            ],
            'kr' => [
                'q' => '해외 배송이 가능한가요?',
                'a' => '물론입니다! 위의 메뉴에 표시된 국가는 자동 결제가 설정된 곳입니다.<br><br>송진 2개 이상 주문 시 전 세계 무료 배송입니다.<br><br>국가가 목록에 없을 경우, 이메일로 문의 주시면 배송 및 세관 수수료를 확인해드리겠습니다: <strong>[bassment_email]</strong>'
            ],
        ],
        'other_rosins_planned' => [
            'en' => [
                'q' => 'Will you make any other bass rosins?',
                'a' => 'I’ve been working on a lasting version of a popular bass rosin for a few years. It’s a slow process of tweaking and refining. Making a weak copy wouldn’t help anyone, so it’s important to get it right. Stay tuned!'
            ],
            'fr' => [
                'q' => 'Prévoyez-vous de fabriquer d’autres colophanes pour contrebasse ?',
                'a' => 'Je travaille depuis plusieurs années sur une version durable d’une colophane populaire. C’est un processus lent d’ajustement et d’affinage. Produire une copie faible n’aiderait personne ; il est donc essentiel de bien faire les choses. Restez à l’écoute !'
            ],
            'de' => [
                'q' => 'Wirst du weitere Bassharze herstellen?',
                'a' => 'Ich arbeite seit einigen Jahren an einer haltbaren Variante eines bekannten Bassharzes. Es ist ein langsamer Prozess aus Anpassen und Verfeinern – eine schwache Kopie würde niemandem helfen. Deshalb ist es wichtig, es richtig zu machen. Bleib dran!'
            ],
            'jp' => [
                'q' => '今後ほかのコントラバス松脂を作る予定はありますか？',
                'a' => '数年前から人気のある松脂の「長持ちする」改良版を研究しています。微調整と改良を重ねるゆっくりしたプロセスであり、中途半端な製品を出すことは意味がありません。完璧なものに仕上げることが大切です。どうぞご期待ください。'
            ],
            'no' => [
                'q' => 'Kommer du til å lage flere bassharpikser?',
                'a' => 'Jeg har jobbet i flere år med en holdbar versjon av en kjent bassharpiks. Det er en langsom prosess med justering og finpussing. Å lage en svak kopi hjelper ingen, så det er viktig å få det riktig. Følg med!'
            ],
            'tw' => [
                'q' => '你會再推出其他低音松香嗎？',
                'a' => '我已經花了好幾年在開發一款能長效使用的熱門松香版本。這是個需要不斷微調與改進的慢工。做出軟弱的仿品沒有意義，因此我必須確保它真的完美。敬請期待！'
            ],
            'sv' => [
                'q' => 'Kommer du att göra fler basrosiner?',
                'a' => 'Jag har arbetat i flera år på en hållbar version av ett välkänt basrosin. Det är en långsam process av justering och finslipning. En svag kopia skulle inte hjälpa någon, så det är viktigt att få det rätt. Håll utkik!'
            ],
            'kr' => [
                'q' => '다른 베이스 송진도 만들 계획이 있나요?',
                'a' => '몇 년째 인기 송진의 지속형 버전을 개발 중입니다. 조정과 개선을 반복하는 느린 과정이지만, 완성도 높은 제품을 만드는 것이 중요합니다. 기대해 주세요!'
            ],
        ],
    ];

    // --- Data Processing (Modified) ---

    // Render [bassment_email] once and keep raw HTML
    $email_html = do_shortcode('[bassment_email]');

    // Initialize the new language-grouped structure for rendering
    $faq_render = [];
    foreach ($langs as $code => $label) {
        $faq_render[$code] = [];
    }

    // Repopulate $faq_render by iterating through questions and then languages
    foreach ($faq_by_question as $q_key => $translations) {
        foreach ($translations as $code => $item) {
            // Ensure the language code is supported
            if (array_key_exists($code, $faq_render)) {
                // Replace shortcode placeholder with the HTML
                $answer = str_replace('[bassment_email]', $email_html, $item['a']);

                $faq_render[$code][] = [
                    'q' => $item['q'],
                    // Use htmlspecialchars_decode to prevent wp_json_encode from double-escaping
                    'a' => htmlspecialchars_decode($answer, ENT_QUOTES),
                ];
            }
        }
    }

    // Fallback/Ensure all languages have the same number of questions by adding 'en' if missing (optional sanity check)
    // (Your original data structure suggests all translations are complete, so this is just for robustness)
    $en_count = count($faq_render['en']);
    foreach ($faq_render as $code => $items) {
        if (count($items) !== $en_count) {
            // In a real-world scenario, you'd handle missing translations more gracefully,
            // perhaps by copying the 'en' version if a translation is missing.
            // For now, we assume data integrity based on the original request.
        }
    }


    // --- Output (Unchanged) ---

    ob_start();
    ?>
<div id="faq" class="faq-lang-select">
    <label for="faq-lang">🌐 Language:</label>
    <select id="faq-lang">
        <?php
        foreach ($langs as $code => $label) {
            $selected = ($code === $initial_lang) ? ' selected' : ''; // Use $initial_lang here
            echo '<option value="' . esc_attr($code) . '"' . $selected . '>' . esc_html($label) . '</option>';
        }

        ?>
    </select>
</div>

<div id="faq-section" class="bassment-faq-grid"></div>

<script type="application/json" id="faq-data">
    <?php echo wp_json_encode($faq_render, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>
    </script>
<style>
    #faq {
        scroll-margin-top: -400px !important;
    }

    .faq-lang-select {
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .faq-lang-select label {
        font-weight: 600;
        font-size: 1rem;
    }

    #faq-lang {
        width: 200px;
        padding: 6px 10px;
        border: 1px solid #ccc;
        border-radius: 6px;
        background-color: #fff;
        font-size: 0.95rem;
        color: #222;
        appearance: none;
        background-image: linear-gradient(45deg, transparent 50%, #555 50%),
            linear-gradient(135deg, #555 50%, transparent 50%);
        background-position: calc(100% - 15px) center, calc(100% - 10px) center;
        background-size: 5px 5px, 5px 5px;
        background-repeat: no-repeat;
        cursor: pointer;
    }

    #faq-lang:focus {
        border-color: #666;
        outline: none;
    }

    .bassment-faq-grid {
        display: grid !important;
        align-items: start;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
        max-width: 1440px;
    }

    @media (max-width: 768px) {
        .bassment-faq-grid {
            grid-template-columns: 1fr;
        }
    }

    .grid-round-box {
        background: #fff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    }

    /* Accordion refined style */
    .faq-item {
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 4px;
        background: #fff;
        transition: background 0.25s ease;
    }

    .faq-item:hover {
        background: #f9f9f9;
    }

    .faq-question {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 22px;
        cursor: pointer;
        font-weight: 500;
        font-size: 1rem;
        letter-spacing: 0.01em;
        border-bottom: 1px solid #eee;
    }

    .faq-text {
        color: #111;
    }

    .faq-toggle {
        position: relative;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
    }

    .faq-toggle::before,
    .faq-toggle::after {
        content: "";
        position: absolute;
        background-color: #555;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        transition: all 0.3s ease;
    }

    .faq-toggle::before {
        width: 12px;
        height: 1.5px;
        /* horizontal bar */
    }

    .faq-toggle::after {
        width: 1.5px;
        height: 12px;
        /* vertical bar */
    }

    .faq-item.open .faq-toggle::after {
        height: 0;
        /* becomes minus */
    }

    .faq-answer {
        max-height: 0;
        overflow: hidden;
        padding: 0 22px;
        color: #333;
        line-height: 1.55;
        font-size: 0.95rem;
        transition: max-height 0.3s ease, padding 0.3s ease;
        background: #fafafa;
    }

    .faq-item.open .faq-answer {
        max-height: 500px;
        padding: 14px 22px 22px;
    }
</style>

<script>
    document.addEventListener('DOMContentLoaded', function () {
        var dataEl = document.getElementById('faq-data');
        var faqData = {};
        try { faqData = JSON.parse(dataEl.textContent); } catch (e) { console.error('FAQ JSON parse error', e); }
        var select = document.getElementById('faq-lang');
        var container = document.getElementById('faq-section');

        function render(lang) {
            var set = faqData[lang] || faqData.en || [];
            container.innerHTML = set.map(function (item, i) {
                var isOpen = i < 2; // first two open
                return `
                                <div class="faq-item${isOpen ? ' open' : ''}">
                                  <div class="faq-question">
                                    <span class="faq-text">${item.q}</span>
                                    <span class="faq-toggle"></span>
                                  </div>
                                  <div class="faq-answer">${item.a}</div>
                                </div>`;
            }).join('');

            container.querySelectorAll('.faq-question').forEach(question => {
                question.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const item = this.closest('.faq-item');
                    item.classList.toggle('open');
                });
            });
        }

        render('<?php echo $initial_lang; ?>');
        select.value = '<?php echo $initial_lang; ?>';
        select.addEventListener('change', function () { render(this.value); });
    });
</script>

<?php
        return ob_get_clean();
});
// Return Policy
add_shortcode('bassment_return_policy', function () {
    return do_shortcode('
  <section class="return-policy-page">
    <div class="return-policy">
      <h2>Returns & Refunds</h2>
	  <p class="lead">Many of us have tried rosins that claim to be "long-lasting" but with no policy behind that statement.</p>
      <p class="lead">If you’re unsatisfied with your rosin for any reason, you can return your order within <strong>1 year</strong> of purchase for a refund.</p>
      <ul>
        <li>Once a refund has been issued, future orders are not eligible for return.</li>
        <li>Email [bassment_email] with your order number to request a return.</li>
        <li>Return shipping is paid by the buyer. If requested, I can provide a prepaid return label and deduct its cost from your refund.</li>
        <li>Refunds cover the item price only and are sent to your original payment method once the return arrives.</li>
      </ul>
    </div>
  </section>

  <style>
  .return-policy-page {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
  }
  .return-policy {
    flex: 1;
    max-width: 600px;
    margin: 3rem auto;
    font-size: 1rem;
    line-height: 1.6;
    font-family: system-ui, sans-serif;
	text-align: left;
  }
  .return-policy h2 {
    font-size: 1.4rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-bottom: 1rem;
  }
  .return-policy .lead {
    margin-bottom: 1.5rem;
    font-size: 1.05rem;
  }
  .return-policy ul {
    list-style: none;
    padding: 0;
  }
  .return-policy li {
    margin-bottom: 0.9rem;
    border-left: 2px solid currentColor;
    padding-left: 0.75rem;
  }
  .return-policy a {
    text-decoration: none;
  }
  .return-policy a:hover {
    text-decoration: underline;
  }
  </style>
  ');
});
//Return policy link at guarantee add-to-cart section
add_shortcode('bassment_return_policy_link', function () {
    return do_shortcode('
	<span style="font-size:1rem;color:#BBB">1-year <a href="#return-modal" class="open-return" 
	   style="color:#BBB;text-decoration:none;border-bottom:1px solid #BBB;">
	   money-back guarantee</a></span>

  <div id="return-modal" class="modal">
    <div class="modal-content">
      <button class="close" aria-label="Close">&times;</button>
      [bassment_return_policy]
    </div>
  </div>

  <style>
  .modal {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }
  .modal.open { display: flex; }
	.modal-content {
      background: rgba(0,0,0,0.95);
	  color: #ddd;
	  max-width: 640px;
	  width: 100%;
	  border-radius: 6px;
	  padding: 2rem;
	  overflow-y: auto;
	  max-height: 90vh;
	  position: relative;
	}
  .modal .close {
  	color:#ddd;
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    background: none;
    border: none;
    font-size: 3rem;
    cursor: pointer;
  }
  </style>

  <script>
  document.addEventListener("click", function(e) {
    if (e.target.matches(".open-return")) {
      e.preventDefault();
      document.querySelector("#return-modal").classList.add("open");
    }
    if (e.target.matches(".close") || (e.target.id === "return-modal")) {
      document.querySelector("#return-modal").classList.remove("open");
    }
  });
  </script>
  ');
});
// 1-Year Guarantee section with return policy
add_shortcode('bassment_guarantee_section', function () {
    return do_shortcode('
    <div style="font-size:1rem;">
      [bassment_return_policy_link]
    </div>
  </section>
  ');
});
//Privacy Policy
// Privacy Policy shortcode
add_shortcode('bassment_privacy_policy', function () {
    return '
  <section class="privacy-policy">
    <h2>Privacy Policy</h2>
    <p><em>Last updated: October 2025</em></p>

    <p>We genuinely respect your privacy. Bassment Rosin LLC collects only the information needed to process and ship your order.</p>

    <ul>
      <li><strong>What we collect:</strong> name, email, shipping address, and payment details handled securely by our payment processor (we never see your full card number).</li>
	  <li><strong>How we use it:</strong> to fulfill your order, handle support questions, and contact you directly if needed about your purchase or if you have reserved your spot in line during a break. Very rarely, like if I ever make another rosin, I might email you once to let you know.</li>
      <li><strong>Cookies:</strong> our site uses basic cookies and analytics to keep the store running smoothly. You can block cookies in your browser without affecting your ability to shop.</li>
	  <li><strong>Email:</strong> We don’t send regular marketing emails or share your data with advertisers. If you’ve ordered before, you might occasionally receive a personal update if there’s something major to announce.</li>
	  <li><strong>Analytics:</strong> We use PostHog to understand how visitors use our website and improve the shopping experience. Data is anonymous and never shared with advertisers.</li>
	  <li><strong>Data security:</strong> Order information is stored securely by our payment and e-commerce providers (such as Stripe and WooCommerce). Analytics data is handled by PostHog using encrypted servers. We keep only what’s needed for tax and support purposes and delete data when no longer required.</li>
	  <li><strong>Data sharing:</strong> We don’t sell your personal data or share it with anyone outside the services needed to run this site. These include WooCommerce, Stripe, and other processors for payments, and PostHog for anonymous site analytics. None of these services use your data for advertising.</li>
    </ul>

    <p>We operate in New Jersey, USA, and comply with all applicable U.S. consumer-protection and privacy laws.</p>

    <p><strong>Contact:</strong> [bassment_email]</p>
  </section>

  <style>
  .privacy-policy {
    padding-top: 0;
    margin: 3rem auto;
	margin-top: 0;
    line-height: 1.6;
    color: inherit;
  }
  .privacy-policy h2 {
    max-width:700px;
    text-align: left;
    font-size: 1.4rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
	.privacy-policy ul,
	.privacy-policy p {
	  max-width: 700px;
	  margin-left: auto;
	  margin-right: auto;
	  line-height: 1.6;
	}
	.privacy-policy ul {
	  list-style: disc;
	  padding-left: 1.5rem;
	  margin-bottom: 1rem;
	}
  .privacy-policy li {
    margin-bottom: 0.5rem;
  }
  </style>
  ';
});

// Terms of Service shortcode
add_shortcode('bassment_terms_of_service', function () {
    return <<<HTML
  <section class="bassment-terms-wrapper">
    <div class="bassment-terms">
      <h2>Terms and Conditions</h2>
      <p><em>Last updated: October 2025</em></p>

      <ul>
        <li><strong>Overview:</strong> This website is operated by Bassment Rosin LLC. By placing an order, you agree to these terms.</li>

        <li><strong>Orders and Payment:</strong> Prices are shown in the local currency based on your shipping country or the currency you select to pay in. Payments are processed securely through Stripe and other trusted payment partners. Prices and exchange rates may change without notice.</li>

        <li><strong>Shipping and Returns:</strong> Orders ship from New Jersey, USA. Refunds and returns follow our <a href="/refund_returns">Return Policy</a>.</li>

        <li><strong>Product Information:</strong> We do our best to describe our rosin accurately. Colors, textures, or packaging may vary slightly.</li>

        <li><strong>Warranty:</strong> Products are backed by an implied warranty of merchantability, meaning they should perform as expected for normal use. Our 1-year guarantee offers a clear, no-hassle way to return your rosin if you are not satisfied.</li>

        <li><strong>Liability:</strong> Bassment Rosin LLC is not liable for any indirect, incidental, or consequential damages, including but not limited to damage to instruments, equipment, or other property. Our total liability for any claim will not exceed the purchase price of the item in question.</li>

        <li><strong>Privacy:</strong> Personal information is handled in accordance with our <a href="/privacy-policy">Privacy Policy</a>.</li>

        <li><strong>Currency and Exchange:</strong> Some prices are displayed in local currencies. Payments and refunds are processed at the rate provided by our payment processor. No hidden fees or surcharges are added by us.</li>

        <li><strong>Governing Law:</strong> These terms are governed by the laws of the State of New Jersey, USA.</li>

        <li><strong>Contact:</strong> [bassment_email]</li>
      </ul>
    </div>
  </section>

  <style>
  .bassment-terms-wrapper {
    max-width: 700px;
    margin: 3rem auto;
    color: inherit;
  }
  .bassment-terms h2 {
    text-align: left;
    font-size: 1.4rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
  .bassment-terms p {
    line-height: 1.6;
    margin-bottom: 1rem;
  }
  .bassment-terms ul {
    list-style: disc;
    padding-left: 1.5rem;
  }
  .bassment-terms li {
    margin-bottom: 0.75rem;
    line-height: 1.6;
  }
  .bassment-terms a {
    text-decoration: underline;
    color: inherit;
  }
  </style>
  HTML;
});
// For Woo Store Vacation mode to not hide shipping dropdown
// [country_select_fallback]
function br_country_select_fallback_shortcode()
{
    // Determine active country (default US)
    $current_country = WC()->customer ? WC()->customer->get_shipping_country() : '';
    if (empty($current_country))
        $current_country = 'US';

    // Build country dropdown
    $shipping_countries = WC()->countries->get_shipping_countries();
    $country_options = '';
    foreach ($shipping_countries as $code => $name) {
        $flag = function_exists('br_get_flag_emoji') ? br_get_flag_emoji($code) : '';
        $selected = (strtoupper($code) === strtoupper($current_country)) ? ' selected' : '';
        $country_options .= sprintf(
            '<option value="%s"%s>%s %s</option>',
            esc_attr(strtolower($code)),
            $selected,
            esc_html($flag),
            esc_html($name)
        );
    }

    ob_start(); ?>
<div id="homepage-country-container" style="margin-top:1rem;">
    <label for="homepage-country-select" style="font-weight:600;color:#BBB;display:block;margin-bottom:0.5rem;">
        Select Shipping Country:
    </label>
    <select id="homepage-country-select" name="homepage-country"
        style="width:100%;padding:0.4rem;background:#121D25;color:#BBB;">
        <?php echo $country_options; ?>
    </select>
</div>

<script>
    jQuery(function ($) {
        var mapping = window.brCountryMapping || {};

        function setSessionForCountry(val) {
            if (!val || !mapping[val]) return $.Deferred().resolve().promise();
            return $.post('<?php echo admin_url('admin-ajax.php'); ?>', {
                action: 'set_country_currency',
                country: mapping[val].country
            });
        }

        // initialize and trigger same logic the main dropdown had
        var val = $('#homepage-country-select').val();
        if (mapping[val]) {
            setSessionForCountry(val);
            $(document.body).trigger('updated_checkout');
        }

        $('#homepage-country-select').on('change', function () {
            var val = $(this).val();
            if (mapping[val]) {
                setSessionForCountry(val).done(function () {
                    // trigger price and VAT recalculation logic
                    $(document.body).trigger('updated_checkout');
                    $(window).trigger('country:changed', [val]);
                });
            }
        });
    });
</script>
<?php
        return ob_get_clean();
}
add_shortcode('country_select_fallback', 'br_country_select_fallback_shortcode');
// fire video workaround caching
add_action('wp_footer', function () {
    ?>
<script>
    document.addEventListener('DOMContentLoaded', function () {
        // Target the specific background video source
        const source = document.querySelector('source[src*="winter-fireplace3.mp4"]');
        if (!source) return;

        const v = source.closest('video');
        if (!v) return;

        // Remove lazy attributes Elementor or theme added
        v.removeAttribute('loading');
        v.removeAttribute('data-lazy');
        v.classList.remove('lazyloaded', 'lazyload');

        // Force eager load
        v.setAttribute('preload', 'auto');

        // Force immediate decode + buffer
        v.load();
        v.play().catch(() => { });
    });
</script>
<?php
});
/**
 * Switzerland: Limit orders to 1 rosin per order.
 * If the customer wants more, they must email to arrange multiple parcels.
 */

add_action('woocommerce_checkout_process', function () {

    $country = '';
    if (WC()->customer) {
        $country = WC()->customer->get_shipping_country() ?: WC()->customer->get_billing_country();
        $country = strtoupper($country);
    }

    if ($country !== 'CH')
        return;

    $cart_count = WC()->cart ? WC()->cart->get_cart_contents_count() : 0;
    if ($cart_count > 1) {
        wc_add_notice(
            'For Switzerland, to order more than one rosin please email me at <strong>bassmentrosin@gmail.com</strong> and I’ll arrange the best shipping option.',
            'error'
        );
    }
});
/**
 * Add a Currency Dropdown to the WooCommerce "Add Order" Admin Panel
 */

// 1. Add the select field to the "General" order data section
add_action('woocommerce_admin_order_data_after_order_details', 'gemini_add_currency_selector_to_order');

function gemini_add_currency_selector_to_order($order)
{
    // Get the current currency of the order (defaults to store currency)
    $current_currency = $order->get_currency();

    // Get all currencies defined in WooCommerce settings
    $currencies = get_woocommerce_currencies();

    // Only show if the order is editable (pending, draft, etc)
    if (!$order->is_editable()) {
        return;
    }

    ?>
<p class="form-field form-field-wide">
    <label for="order_currency_override" style="font-weight:bold;">
        <?php _e('Order Currency', 'woocommerce'); ?>
    </label>
    <select name="order_currency_override" id="order_currency_override" class="wc-enhanced-select">
        <?php foreach ($currencies as $code => $name): ?>
        <option value="<?php echo esc_attr($code); ?>" <?php selected($current_currency, $code); ?>>
            <?php echo esc_html($name . ' (' . $code . ')'); ?>
        </option>
        <?php endforeach; ?>
    </select>
    <span class="description" style="display:block; margin-top:5px; color:#666;">
        <?php _e('Select the currency and click <b>Create/Update</b> before adding products.', 'woocommerce'); ?>
    </span>
</p>
<?php
}

// 2. Save the selected currency when the order is updated/created
add_action('woocommerce_process_shop_order_meta', 'gemini_save_currency_selector_override', 45, 2);

function gemini_save_currency_selector_override($post_id, $post)
{
    // Security check: ensure our field was sent
    if (!isset($_POST['order_currency_override']))
        return;

    $new_currency = sanitize_text_field($_POST['order_currency_override']);
    $order = wc_get_order($post_id);

    // If the currency is different, update it
    if ($order && $new_currency !== $order->get_currency()) {
        $order->set_currency($new_currency);
        $order->save();
    }
}