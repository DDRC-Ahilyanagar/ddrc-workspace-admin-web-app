import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "दिव्यांग सर्वेक्षण २०२६ | Divyang Survey 2026",
    description: "DDRC Ahilyanagar Divyang Survey 2026 - आपल्या हक्कासाठी आणि लाभासाठी आपली माहिती नोंदवा. अहिल्यानगर जिल्हा प्रशासनाचा अधिकृत उपक्रम.",
    keywords: ["Divyang Survey", "अहिल्यानगर", "दिव्यांग सर्वेक्षण", "DDRC Survey", "Maharashtra Disability Survey"],
    openGraph: {
        title: "दिव्यांग सर्वेक्षण २०२६ - अधिकृत पोर्टल",
        description: "अहिल्यानगर जिल्ह्यातील दिव्यांग बांधवांसाठी विशेष सर्वेक्षण अभियान. सहभागी व्हा आणि शासकीय लाभांचा मार्ग सुकर करा.",
    }
};

export default function SurveyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
