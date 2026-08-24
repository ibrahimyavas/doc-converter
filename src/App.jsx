import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import ConverterCard from "./components/ConverterCard.jsx";
import CompressCard from "./components/CompressCard.jsx";
import StudyCard from "./components/StudyCard.jsx";
import FeatureGrid from "./components/FeatureGrid.jsx";
import Faq from "./components/Faq.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ConverterCard />
        <CompressCard />
        <StudyCard />
        <FeatureGrid />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
