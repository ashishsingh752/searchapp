const asyncHandler = require("express-async-handler");
const calculateNextBillingDate = require("../utils/nextBillingDate");
const shouldRenewal = require("../utils/shouldRenewal");
const Payment = require("../models/Payment.model");

// const stripe = require("stripe")(process.env.MY_KEY)  // what is the difference , also I have to look in this part more (revise)
const stripe = require("stripe")(
  "sk_test_51OT0d1SFdvILEADbipAcxOMXnnsCjqDYCgNCq6JU3ccUgvl0YLfGVQlnr0Y1jEvQSCoJSWFW1MfEBCy6OY9OQSzG00eNyppiD9"
);

// --- strip payment---
const handleStripePayment = asyncHandler(async (req, res, next) => {
  // console.log(process.env.MY_KEY);
  const { amount, subscriptionPlan } = req.body;
  //get the user
  const user = req?.user;
  //   console.log(user);
  try {
    // create payment intent  https://chat.openai.com/c/751d9910-196d-471f-9412-4f315d78762b
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Number(amount) * 100,
      currency: "usd",
      // add some data , tha meta object
      metadata: {
        userId: user?._id?.toString(),
        userEmail: user?.email,
        subscriptionPlan,
      },
    });
    // send the response
    // console.log(paymentIntent);
    res.json({
      clientSecret: paymentIntent?.client_secret,
      paymentId: paymentIntent?.id,
      metadata: paymentIntent?.metadata,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

const handleFreePlan = asyncHandler(async (req, res) => {
  const user = req?.user; //get the login user

  //check for the renewal of the user account
  try {
    if (shouldRenewal(user)) {
      user.subscriptionPlan = "Free";
      user.monthlyRequestCount = 5;
      user.apiRequestCount = 0;
      user.nextBillingDate = calculateNextBillingDate();
      // create a new payment for the freePlan and save into the db
      const newPayment = await Payment.create({
        user: user?.id,
        subscriptionPlan: "Free",
        amount: 0,
        status: "Success",
        reference: Math.random().toString().substring(7),
        monthlyRequestCount: 5,
        currency: "usd",
      });

      user.payments.push(newPayment?._id);

      await user.save();

      res.json({
        status: "success",
        message: "Subscription plan updated successfully",
        user,
      });
    } else {
      return res.status(403).json({ error: "subscription not due yet!" });
    }
  } catch (error) {
    throw new Error(error);
  }
  // create a new payment ans save into db
  // update the user account
});

module.exports = {
  handleStripePayment,
  handleFreePlan,
};