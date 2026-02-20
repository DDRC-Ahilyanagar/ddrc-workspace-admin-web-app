"use server";

// import prisma from "@/lib/prisma";

export type DeleteAccountResponse = {
    success: boolean;
    message: string;
};

export async function deleteAccountAction(formData: FormData): Promise<DeleteAccountResponse> {
    const identifier = formData.get("identifier") as string;

    if (!identifier) {
        return { success: false, message: "Email or Mobile number is required." };
    }

    /*
    try {
        // Find user by email or contact number
        // Only allow deleting field_officer accounts for safety
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { contactNumber: identifier },
                ],
                userType: "field_officer",
            },
        });

        if (!user) {
            return {
                success: false,
                message: "Account not found or you do not have permission to delete this account."
            };
        }

        const userId = user.id;

        // Perform deletion in a transaction
        await prisma.$transaction(async (tx) => {
            // 1. Delete SurveyFiles
            await tx.surveyFile.deleteMany({
                where: { userId },
            });

            // 2. Delete Surveys
            await tx.survey.deleteMany({
                where: { userId },
            });

            // 3. Delete SurveyAadhar
            await tx.surveyAadhar.deleteMany({
                where: { userId },
            });

            // 4. Delete FieldOfficerProfile (should cascade anyway, but let's be explicit if needed)
            // Actually Prisma will handle the cascade if the relation is set to onDelete: Cascade in Prisma.
            // In schema.prisma it says "onDelete: Cascade" for FieldOfficerProfile.
            await tx.fieldOfficerProfile.deleteMany({
                where: { userId },
            });

            // 5. Delete EarlyDetectionBaby records
            await tx.earlyDetectionBaby.deleteMany({
                where: { userId },
            });

            // 6. Finally delete the user
            await tx.user.delete({
                where: { id: userId },
            });
        });

        return {
            success: true,
            message: `Account associated with ${identifier} has been successfully deleted.`
        };
    } catch (error: any) {
        console.error("Account deletion error:", error);
        return {
            success: false,
            message: "An error occurred while deleting the account. Please try again later."
        };
    }
    */
    return {
        success: false,
        message: "Account deletion is temporarily disabled for maintenance."
    };
}
