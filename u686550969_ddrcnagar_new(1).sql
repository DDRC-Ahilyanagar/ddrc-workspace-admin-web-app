-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Nov 27, 2025 at 05:05 AM
-- Server version: 11.8.3-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u686550969_ddrcnagar_new`
--

-- --------------------------------------------------------

--
-- Table structure for table `tbl_matadar_sangh_names`
--

CREATE TABLE `tbl_matadar_sangh_names` (
  `id` int(11) NOT NULL,
  `sangh_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_by` int(11) DEFAULT NULL,
  `created_on` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_on` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tbl_matadar_sangh_names`
--

INSERT INTO `tbl_matadar_sangh_names` (`id`, `sangh_id`, `name`, `status`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES
(1, 1, '216 अकोले', 'Active', NULL, NULL, NULL, NULL),
(2, 1, '217 संगमनेर', 'Active', NULL, NULL, NULL, NULL),
(3, 1, '218 शिर्डी', 'Active', NULL, NULL, NULL, NULL),
(4, 1, '219 कोपरगाव', 'Active', NULL, NULL, NULL, NULL),
(5, 1, '220 श्रीरामपूर', 'Active', NULL, NULL, NULL, NULL),
(6, 1, '221 नेवासा', 'Active', NULL, NULL, NULL, NULL),
(7, 2, '222 शेवगाव', 'Active', NULL, NULL, NULL, NULL),
(8, 2, '223 राहुरी', 'Active', NULL, NULL, NULL, NULL),
(9, 2, '224 पारनेर', 'Active', NULL, NULL, NULL, NULL),
(10, 2, '225 अहमदनगर शहर', 'Active', NULL, NULL, NULL, NULL),
(11, 2, '226 श्रीगोंदा', 'Active', NULL, NULL, NULL, NULL),
(12, 2, '227 कर्जत-जामखेड', 'Active', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_milestone`
--

CREATE TABLE `tbl_milestone` (
  `id` int(11) NOT NULL,
  `months` varchar(255) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `marathi_title` varchar(255) DEFAULT NULL,
  `english_title` varchar(255) DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_by` int(11) DEFAULT NULL,
  `created_on` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_on` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_milestone`
--

INSERT INTO `tbl_milestone` (`id`, `months`, `image`, `marathi_title`, `english_title`, `status`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES
(1, '3-4', 'm1.png', 'बाळ वस्तू पकडू लागते', 'Baby starting to grasp objects', 'Active', 1, '2023-12-21 16:08:28', 1, '2024-09-20 16:04:50'),
(2, '3-4', 'm2.png', 'दोन्ही हात पोहचू लागतात', 'Bidextrous reach', 'Active', 1, '2023-12-21 16:08:28', NULL, NULL),
(3, '3-4', 'm3.png', 'एक हात पोहचू लागतो', 'Unidextrous reach', 'Active', 1, '2023-12-21 16:08:28', NULL, NULL),
(4, '3-4', 'm4.jpg', 'बाळ हात आणि पाय बांधून (घट्ट करून) पाठीवर पडू लागते', 'LYING ON BACK WITH CLINCHED HANDS AND LEGS', 'Active', 1, '2023-12-21 16:08:28', NULL, NULL),
(5, '3-4', 'm5.png', 'मान पकडू लागते', 'NECK HOLDING', 'Active', 1, '2023-12-21 16:08:28', NULL, NULL),
(6, '3-4', 'm6.png', 'आईला ओळखू लागते', 'Baby Recognise mother', 'Active', 1, '2023-12-21 16:08:28', NULL, NULL),
(7, '3-4', 'm7.png', 'खेळणीकडे हात वळवते', 'Baby reaching towards toys', 'Active', 1, '2023-12-21 16:08:28', NULL, NULL),
(8, '3-4', 'm8.png', 'खेळणीकडे पाहते', 'Baby looking at the toy', 'Active', 1, '2023-12-21 16:08:28', NULL, NULL),
(9, '5-8', 'm9.png', 'चिमटीत पकडण्याचा प्रयत्न करू लागते', 'Immature pincer grasp', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(10, '5-8', 'm10.png', 'हातांच्या कोपरावर वजन देऊ लागते', 'Baby putting weight on arms', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(11, '5-8', 'm11.png', 'बाळ लोळू लागते', 'ROLLS OVER', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(12, '5-8', 'm12.png', 'तिपाई स्थिती मध्ये बसू लागते', 'SITS IN TRIPOD POSITION', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(13, '5-8', 'm13.png', 'बाळ पोटावर रांगू लागते', 'Baby crawling on stomach', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(14, '5-8', 'm14.png', 'बाळ पाठीवर झोपून डोके ऊचलू लागते', 'HEAD LIFTING IN SUPINE', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(15, '5-8', 'm15.png', 'बाळ पाठीवर झोपून पाय डोक्यास लावते', 'SUPINE FEET TO HEAD', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(16, '5-8', 'm16.png', 'बाळ पाठीवर झोपून पाय तोंडात घालू लागते', 'SUPINE FEET TO MOUTH ', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(17, '5-8', 'm17.png', 'बाळ हातांच्या सहाय्याने बसू लागते', 'PROPPED SITTING', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(18, '5-8', 'm18.png', 'बाळ हाताने वस्तू हस्तांतरित करण्यास सुरवात करते', 'TRANSFER OBJECTS HANDS IN HANDS', 'Active', 1, '2023-12-22 11:04:12', NULL, NULL),
(19, '8-10', 'm19.png', 'बोटाने तपासू लागते', 'Probes with forefingers', 'Active', 1, '2023-12-22 11:15:11', NULL, NULL),
(20, '8-10', 'm20.png', 'बोटांची पकड मजबूत होते', 'Pincer grasp mature', 'Active', 1, '2023-12-22 11:15:11', NULL, NULL),
(21, '8-10', 'm21.png', 'बाळ आधाराशिवाय बसू लागते', 'SITTING WITHOUT SUPPORT', 'Active', 1, '2023-12-22 11:15:11', NULL, NULL),
(22, '8-10', 'm22.png', 'बाळ रांगू लागते', 'Crawling', 'Active', 1, '2023-12-22 11:15:11', NULL, NULL),
(23, '8-10', 'm23.png', 'बाळ उत्तम प्रकारे रांगू लागते', 'BABY CREEPS WELL', 'Active', 1, '2023-12-22 11:15:11', NULL, NULL),
(24, '11-12', 'm24.png', 'बाळ आधाराने ऊभे राहू लागते', 'STANDS WITH SUPPORT', 'Active', 1, '2023-12-22 11:17:50', NULL, NULL),
(25, '11-12', 'm25.png', 'बाळ आधाराशिवाय ऊभे राहू लागते', 'BABY STANDS WITHOUT SUPPORT', 'Active', 1, '2023-12-22 11:17:50', NULL, NULL),
(26, '11-12', 'm26.png', 'हात धरून पाऊल टाकू लागते', 'BABY HOLDING HANDS AND WALKING', 'Active', 1, '2023-12-22 11:17:50', NULL, NULL),
(27, '11-12', 'm27.png', 'वस्तूंचा आधार घेऊन चालू लागते', 'BABY WALKS WITH SUPPORT', 'Active', 1, '2023-12-22 11:17:50', NULL, NULL),
(28, '11-12', 'm28.png', 'बाळ स्वत: ऊभे राहून चालू लागते', 'WALK INDEPENDENTLY', 'Active', 1, '2023-12-22 11:17:50', NULL, NULL),
(29, '13-18', 'm29.png', 'रेघोट्या मारू लागते', 'Imitates scribbling ', 'Active', 1, '2023-12-22 11:20:17', NULL, NULL),
(30, '13-18', 'm30.jpg', 'ठोकळ्यांचे तीन थर बनवू लागते', 'Tower 3 blocks', 'Active', 1, '2023-12-22 11:20:17', NULL, NULL),
(31, '13-18', 'm31.png', 'बाळ रांगत पायऱ्या चढू लागते', 'BABY CREEPS UPSTAIRS', 'Active', 1, '2023-12-22 11:20:17', NULL, NULL),
(32, '13-18', 'm32.png', 'बाळ धाऊ लागते', 'RUNS', 'Active', 1, '2023-12-22 11:20:17', NULL, NULL),
(33, '13-18', 'm33.jpg', 'हात धरून पायऱ्या चढू लागते', 'STAIR CLIMBING WITH SUPPORT', 'Active', 1, '2023-12-22 11:20:17', NULL, NULL),
(34, '13-18', 'm34.png', 'एकटे चालू लागते', 'WALKS ALONE', 'Active', 1, '2023-12-22 11:20:17', NULL, NULL),
(35, '19-24', 'm35.jpg', 'जिना चढू- ऊतरू लागते', 'Walks up and downstairs', 'Active', 1, '2023-12-22 11:21:46', NULL, NULL),
(36, '19-24', 'm36.jpg', 'उडी मारू लागते', 'Jumps', 'Active', 1, '2023-12-22 11:21:46', NULL, NULL),
(37, '19-24', 'm37.png', 'एका पायावर ऊभे राहू लागते', 'BABY STANDS ON ONE FEET', 'Active', 1, '2023-12-22 11:21:46', NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tbl_matadar_sangh_names`
--
ALTER TABLE `tbl_matadar_sangh_names`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tbl_milestone`
--
ALTER TABLE `tbl_milestone`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tbl_matadar_sangh_names`
--
ALTER TABLE `tbl_matadar_sangh_names`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `tbl_milestone`
--
ALTER TABLE `tbl_milestone`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
