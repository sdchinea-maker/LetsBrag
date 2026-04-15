// netlify/functions/stripe-webhook.js
// Handles Stripe webhooks to unlock user tiers after payment

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service key (not anon) for server-side writes
);

const PRICE_TO_TIER = {
  // Replace these with your actual Stripe Price IDs from your dashboard
  // Stripe Dashboard → Products → click product → copy Price ID (price_xxx)
  [process.env.STRIPE_PRICE_BASIC_MONTHLY]:  "basic",
  [process.env.STRIPE_PRICE_BASIC_ANNUAL]:   "basic",
  [process.env.STRIPE_PRICE_NCO_MONTHLY]:    "nco",
  [process.env.STRIPE_PRICE_NCO_ANNUAL]:     "nco",
  [process.env.STRIPE_PRICE_PROMAX_MONTHLY]: "promax",
  [process.env.STRIPE_PRICE_PROMAX_ANNUAL]:  "promax",
};

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle successful subscription
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const customerEmail = session.customer_details?.email;
    const priceId = session.line_items?.data?.[0]?.price?.id;

    if (!customerEmail) {
      return { statusCode: 200, body: "No email found" };
    }

    // Get tier from price ID
    const tier = PRICE_TO_TIER[priceId] || "basic";

    // Find user by email in Supabase auth
    const { data: users } = await supabase.auth.admin.listUsers();
    const matchedUser = users?.users?.find(u => u.email === customerEmail);

    if (matchedUser) {
      // Update their tier in user_data table
      await supabase.from("user_data").upsert({
        user_id: matchedUser.id,
        tier,
        stripe_customer_id: session.customer,
        subscription_id: session.subscription,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

      console.log(`Unlocked ${tier} for ${customerEmail}`);
    } else {
      // Store pending unlock by email — will apply on first login
      await supabase.from("pending_upgrades").upsert({
        email: customerEmail,
        tier,
        stripe_customer_id: session.customer,
        created_at: new Date().toISOString()
      }, { onConflict: "email" });

      console.log(`Pending upgrade stored for ${customerEmail}`);
    }
  }

  // Handle subscription cancelled
  if (stripeEvent.type === "customer.subscription.deleted") {
    const subscription = stripeEvent.data.object;
    const customerId = subscription.customer;

    // Downgrade back to free
    await supabase.from("user_data")
      .update({ tier: "free", updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", customerId);

    console.log(`Downgraded customer ${customerId} to free`);
  }

  return { statusCode: 200, body: "OK" };
};